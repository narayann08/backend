'use strict';
const { ChatOpenAI } = require('@langchain/openai');
const { HumanMessage, SystemMessage } = require('@langchain/core/messages');
const env = require('../../config/env');
const logger = require('../../utils/logger');
const openMeteoTool = require('../mcp-tools/openMeteoTool');
const nasaPowerTool = require('../mcp-tools/nasaPowerTool');
const WeatherSnapshot = require('../../models/WeatherSnapshot');

/**
 * Weather-Reasoning Agent.
 *
 * Reconciles numerical weather forecasts from Open-Meteo API
 * (https://api.open-meteo.com/v1/forecast) with NASA POWER satellite-derived
 * solar radiation and meteorological observations (/temporal/hourly/point).
 *
 * @param {object} plant - Mongoose Plant document (lean)
 * @param {number} hours - Forecast horizon in hours
 * @returns {Promise<object>} Saved WeatherSnapshot document
 */
async function runWeatherReasoningAgent(plant, hours = 72) {
  const start = Date.now();
  logger.info(`[WeatherAgent] Starting for plant ${plant._id} (${plant.name}), horizon=${hours}h`);

  // ── Step 1: Call Open-Meteo and NASA POWER in parallel ─────────────────────
  const [openMeteoResult, nasaResult] = await Promise.allSettled([
    openMeteoTool.handler({ latitude: plant.latitude, longitude: plant.longitude, hours, plantType: plant.type }),
    nasaPowerTool.handler({ latitude: plant.latitude, longitude: plant.longitude, hours, plantType: plant.type }),
  ]);

  const openMeteo = openMeteoResult.status === 'fulfilled' ? openMeteoResult.value : null;
  const nasa      = nasaResult.status      === 'fulfilled' ? nasaResult.value      : null;

  logger.info(
    `[WeatherAgent] Sources: openMeteo=${!!openMeteo?.hourly?.length}, ` +
    `nasaPower=${!!nasa?.available}`
  );

  // ── Step 2: Use LLM to reconcile data sources ─────────────────────────────
  const llm = new ChatOpenAI({
    openAIApiKey: env.XAI_API_KEY,
    modelName:    env.XAI_MODEL,
    maxTokens:    4096,
    configuration: { baseURL: env.XAI_BASE_URL },
  });

  const systemPrompt = `You are the Weather-Reasoning Agent for FluxCast, a renewable energy forecasting platform.
Your job is to reconcile weather data from Open-Meteo (NWP forecast) and NASA POWER API (satellite-derived solar & met data) to produce a single trusted hourly forecast.

Reconciliation rules:
1. Open-Meteo (https://api.open-meteo.com/v1/forecast) is the primary high-resolution numerical weather prediction baseline.
2. NASA POWER provides satellite-derived solar irradiance (ALLSKY_SFC_SW_DWN) and surface meteorological cross-checks.
3. When NASA POWER data is available, blend Open-Meteo (0.75) and NASA POWER (0.25) for irradiance and wind cross-checking.
4. If NASA POWER is unavailable or empty (e.g. future horizon beyond satellite archive), rely 100% on Open-Meteo forecast data.
5. Output ONLY a valid JSON array of hourly entries — no conversational text, no markdown fences — matching this exact schema:
[{"time":"ISO8601","cloudCoverPct":number,"ghiWm2":number,"dniWm2":number,"rainProbabilityPct":number,"temperatureC":number,"humidityPct":number,"windSpeedMs":number,"windDirectionDeg":number,"windGustMs":number,"turbulenceIndex":number}]`;

  const userMessage =
    `Plant: ${plant.name} (${plant.type}), Lat: ${plant.latitude}, Lon: ${plant.longitude}\n` +
    `Horizon: ${hours} hours\n\n` +
    `Open-Meteo (${openMeteo?.hourly?.length || 0} pts, first 3): ${JSON.stringify(openMeteo?.hourly?.slice(0, 3) || [])}\n` +
    `NASA POWER (available: ${nasa?.available}): ${JSON.stringify(nasa?.hourly?.slice(0, 3) || [])}\n\n` +
    `Produce a reconciled array for all ${hours} hours.`;

  let reconciledHourly;
  try {
    const response = await llm.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(userMessage),
    ]);
    reconciledHourly = JSON.parse(response.content);
    logger.info(`[WeatherAgent] LLM reconciliation produced ${reconciledHourly.length} hourly entries`);
  } catch (err) {
    logger.warn('[WeatherAgent] LLM reconciliation failed — falling back to Open-Meteo data:', err.message);
    reconciledHourly = openMeteo?.hourly || [];
  }

  // ── Step 3: Build source label ────────────────────────────────────────────
  const activeSources = [
    openMeteo?.hourly?.length ? 'open-meteo' : null,
    nasa?.available           ? 'nasa-power' : null,
  ].filter(Boolean);
  const sourceLabel = activeSources.length > 0 ? `${activeSources.join('+')} (reconciled)` : 'open-meteo (reconciled)';

  // ── Step 4: Persist and return ────────────────────────────────────────────
  const snapshot = await WeatherSnapshot.create({
    plantId:     plant._id,
    source:      sourceLabel,
    hourly:      reconciledHourly,
    generatedAt: new Date(),
  });

  logger.info(`[WeatherAgent] Completed in ${Date.now() - start}ms — snapshot ${snapshot._id}`);
  return snapshot.toObject();
}

module.exports = { runWeatherReasoningAgent };
