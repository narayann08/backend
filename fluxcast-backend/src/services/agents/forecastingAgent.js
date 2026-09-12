'use strict';
const { completeJson } = require('../llm/xaiClient');
const logger = require('../../utils/logger');
const telemetryTool = require('../mcp-tools/telemetryTool');
const ragRetrieverTool = require('../mcp-tools/ragRetrieverTool');
const ForecastResult = require('../../models/ForecastResult');

/**
 * Forecasting Agent.
 *
 * Combines the reconciled weather snapshot with recent plant telemetry
 * (and, for new plants, RAG-retrieved similar-plant history) to generate
 * an hourly generation forecast with uncertainty bounds and risk windows.
 *
 * @param {object} state - Shared LangGraph workflow state
 * @returns {Promise<object>} Updated state with `forecast` field set
 */
async function runForecastingAgent(state) {
  const { plant, weatherSnapshot, horizon, jobId } = state;
  const start = Date.now();
  logger.info(`[ForecastAgent] Starting for plant ${plant._id}, horizon=${horizon}h`);

  // ── Step 1: Fetch recent telemetry via MCP tool ──────────────────────────
  const telemetry = await telemetryTool.handler({ plantId: plant._id.toString(), days: 4 });
  logger.info(`[ForecastAgent] Telemetry: ${telemetry.length} readings`);

  // ── Step 2: RAG retrieval for plants with limited history ────────────────
  let ragContext = null;
  if (plant.hasLimitedHistory) {
    logger.info('[ForecastAgent] Limited history plant — querying RAG for similar patterns');
    // Build a simple query vector from the first 5 weather points
    // In production, use a real embedding model (e.g. text-embedding-3-small)
    const queryVector = (weatherSnapshot.hourly?.slice(0, 5) || [])
      .flatMap(h => [h.ghiWm2 || 0, h.cloudCoverPct || 0, h.windSpeedMs || 0, h.temperatureC || 0]);
    while (queryVector.length < 20) queryVector.push(0);

    const ragResult = await ragRetrieverTool.handler({
      queryVector: queryVector.slice(0, 20),
      topK:        3,
      plantType:   plant.type,
    });
    ragContext = ragResult.results;
    logger.info(`[ForecastAgent] RAG: ${ragContext.length} similar historical patterns found`);
  }

  // ── Step 3: LLM-powered forecast generation ──────────────────────────────
  const systemPrompt = `You are the Forecasting Agent for FluxCast, a renewable energy AI platform.
Generate an hourly generation forecast given weather data and plant telemetry.

Physics-based rules:
SOLAR plants:
  generation = capacityMW × (ghiWm2 / 1000) × (1 - cloudCoverPct/100 × 0.7) × temp_factor
  temp_factor = 1 - max(0, temperatureC - 25) × 0.004
  Night hours (ghiWm2 ≤ 0): generation = 0

WIND plants:
  cutInSpeed = 3 m/s, ratedSpeed = 12 m/s, cutOutSpeed = 25 m/s
  Below cutIn or above cutOut: generation = 0
  Between cutIn and rated: generation = capacityMW × ((windSpeedMs - 3) / 9)^3
  Between rated and cutOut: generation = capacityMW

Uncertainty:
  lowerBoundMW = expectedMW × 0.85
  upperBoundMW = expectedMW × 1.15
  confidencePct = 75 (standard), 50 if sensorStatus=degraded in recent telemetry

Risk windows (flag if they exist):
  over_generation: expected > 95% of capacityMW for 3+ consecutive hours
  under_generation: expected < 20% capacityMW during daytime hours (8am-6pm local)
  operational_risk: any recent telemetry with sensorStatus=degraded or outage=true

Output ONLY valid JSON — no markdown, no explanation:
{"points":[{"time":"ISO8601","expectedMW":0,"lowerBoundMW":0,"upperBoundMW":0,"confidencePct":75}],"riskWindows":[{"start":"ISO8601","end":"ISO8601","type":"over_generation"}]}`;

  const plantInfo = {
    name: plant.name, type: plant.type, capacityMW: plant.capacityMW,
    solarSpec: plant.solarSpec, windSpec: plant.windSpec, hasLimitedHistory: plant.hasLimitedHistory,
  };

  const userMessage =
    `Plant: ${JSON.stringify(plantInfo)}\n` +
    `Horizon: ${horizon} hours\n` +
    `Weather (${weatherSnapshot.hourly?.length} pts, first 5): ${JSON.stringify(weatherSnapshot.hourly?.slice(0, 5))}\n` +
    `Recent telemetry (last 10): ${JSON.stringify(telemetry.slice(-10))}\n` +
    (ragContext ? `RAG similar patterns: ${JSON.stringify(ragContext)}\n` : '') +
    `\nGenerate a complete ${horizon}-point hourly forecast.`;

  let forecastData;
  try {
    forecastData = await completeJson({ system: systemPrompt, user: userMessage, maxTokens: 8192 });
    logger.info(`[ForecastAgent] LLM produced ${forecastData.points?.length} forecast points`);
  } catch (err) {
    logger.error('[ForecastAgent] LLM forecast failed — using flat 50% fallback:', err.message);
    forecastData = {
      points: Array.from({ length: horizon }, (_, i) => ({
        time:          new Date(Date.now() + i * 3600 * 1000).toISOString(),
        expectedMW:    plant.capacityMW * 0.5,
        lowerBoundMW:  plant.capacityMW * 0.35,
        upperBoundMW:  plant.capacityMW * 0.65,
        confidencePct: 40,
      })),
      riskWindows: [],
    };
  }

  // ── Step 4: Persist and return ────────────────────────────────────────────
  const savedForecast = await ForecastResult.create({
    plantId:      plant._id,
    horizonHours: horizon,
    points:       forecastData.points,
    riskWindows:  forecastData.riskWindows || [],
    jobId,
  });

  logger.info(`[ForecastAgent] Completed in ${Date.now() - start}ms — forecast ${savedForecast._id}`);
  return { ...state, forecast: savedForecast.toObject() };
}

module.exports = { runForecastingAgent };
