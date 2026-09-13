'use strict';
const logger = require('../../utils/logger');
const telemetryTool = require('../mcp-tools/telemetryTool');
const ragRetrieverTool = require('../mcp-tools/ragRetrieverTool');
const ForecastResult = require('../../models/ForecastResult');
const { calibrate, buildForecastPoints } = require('../forecast/generationModel');
const { detectRiskWindows } = require('../forecast/riskWindows');

/**
 * Forecasting Agent.
 *
 * Projects the reconciled weather through the plant's power curve, scaled by a
 * factor fitted on the plant's own recent output, and emits one point per
 * forecast hour with bounds sized from that fit's residuals.
 *
 * This was an LLM call — the model was handed five hours of weather and asked
 * to return twenty-four hours of megawatts. It produced whatever the five
 * hours suggested, which for a snapshot that began at midnight meant a day of
 * zeros. Arithmetic over the full weather series is both correct and free;
 * the language models stay where judgement is actually required, in the
 * decision and explainability steps downstream.
 *
 * @param {object} state - Shared workflow state
 * @returns {Promise<object>} Updated state with `forecast` set
 */
async function runForecastingAgent(state) {
  const { plant, weatherSnapshot, horizon, jobId, simulationMode } = state;
  const start = Date.now();
  logger.info(`[ForecastAgent] Starting for plant ${plant._id}, horizon=${horizon}h`);

  const hourly = weatherSnapshot?.hourly || [];
  if (!hourly.length) {
    throw new Error('Cannot forecast without a weather snapshot');
  }

  // ── Recent output, to fit this site's standing offset from nameplate ─────
  const CALIBRATION_DAYS = 14;
  const telemetry = await telemetryTool.handler({
    plantId: plant._id.toString(),
    days: CALIBRATION_DAYS,
  });
  logger.info(`[ForecastAgent] Telemetry: ${telemetry.length} readings over ${CALIBRATION_DAYS}d`);

  /*
   * The weather snapshot looks forward, so it rarely overlaps the telemetry
   * window. Calibration pairs what was measured with what the weather implied
   * for that same hour, so it needs the past hours too — which is what the
   * snapshot history holds.
   */
  const pastWeather = await recentWeatherHours(plant._id, CALIBRATION_DAYS);
  let calibration = calibrate(plant, telemetry, [...pastWeather, ...hourly]);

  // ── New sites have no history of their own: borrow from similar plants ───
  if (!calibration.calibrated && plant.hasLimitedHistory) {
    const borrowed = await borrowCalibration(plant, hourly);
    if (borrowed) {
      calibration = { ...calibration, ...borrowed };
      logger.info(`[ForecastAgent] Borrowed calibration factor ${borrowed.factor} from RAG peers`);
    }
  }

  logger.info(
    `[ForecastAgent] Calibration: factor=${calibration.factor} samples=${calibration.samples} ` +
    `band=±${(calibration.bandPct * 100).toFixed(1)}% calibrated=${calibration.calibrated}`
  );

  const points = buildForecastPoints({ plant, hourly, calibration, horizon });
  const riskWindows = detectRiskWindows({ plant, points, telemetry });

  const forecastFields = {
    plantId: plant._id,
    horizonHours: horizon,
    points,
    riskWindows,
    calibrationFactor: calibration.factor,
    calibrationSamples: calibration.samples,
    jobId,
  };

  // A simulation must never land in the plant's real forecast history.
  if (simulationMode) {
    logger.info(`[ForecastAgent] Simulation — ${points.length} points, not persisted`);
    return { ...state, forecast: { ...forecastFields, generatedAt: new Date() } };
  }

  const saved = await ForecastResult.create(forecastFields);
  logger.info(
    `[ForecastAgent] Completed in ${Date.now() - start}ms — ${points.length} points, ` +
    `peak ${Math.max(...points.map((p) => p.expectedMW)).toFixed(1)} MW, ` +
    `${riskWindows.length} risk window(s) — forecast ${saved._id}`
  );
  return { ...state, forecast: saved.toObject() };
}

/**
 * Weather hours already stored for this plant, covering the calibration
 * window. Snapshots overlap heavily, so they are flattened newest-last and
 * de-duplicated by hour.
 */
async function recentWeatherHours(plantId, days) {
  const WeatherSnapshot = require('../../models/WeatherSnapshot');
  const since = new Date(Date.now() - days * 24 * 3600 * 1000);
  const snapshots = await WeatherSnapshot.find({ plantId, generatedAt: { $gte: since } })
    .sort({ generatedAt: 1 })
    .lean();
  return snapshots.flatMap((s) => s.hourly || []);
}

/**
 * Ask the vector store for plants that behaved similarly under similar
 * conditions, and take their measured-to-implied ratio as a starting factor.
 * Used only for a site with no history of its own.
 */
async function borrowCalibration(plant, hourly) {
  const queryVector = hourly
    .slice(0, 5)
    .flatMap((h) => [h.ghiWm2 || 0, h.cloudCoverPct || 0, h.windSpeedMs || 0, h.temperatureC || 0]);
  while (queryVector.length < 20) queryVector.push(0);

  try {
    const { results } = await ragRetrieverTool.handler({
      queryVector: queryVector.slice(0, 20),
      topK: 3,
      plantType: plant.type,
    });

    const factors = (results || [])
      .map((r) => r?.metadata?.calibrationFactor)
      .filter((f) => typeof f === 'number' && f > 0);

    if (!factors.length) return null;
    return {
      factor: Number((factors.reduce((s, f) => s + f, 0) / factors.length).toFixed(4)),
      samples: factors.length,
      calibrated: false, // borrowed, so confidence still carries the penalty
    };
  } catch (err) {
    logger.warn(`[ForecastAgent] RAG lookup failed: ${err.message}`);
    return null;
  }
}

module.exports = { runForecastingAgent };
