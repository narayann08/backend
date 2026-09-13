'use strict';
const logger = require('../../utils/logger');
const openMeteoTool = require('../mcp-tools/openMeteoTool');
const nasaPowerTool = require('../mcp-tools/nasaPowerTool');
const WeatherSnapshot = require('../../models/WeatherSnapshot');

/**
 * Weather-Reasoning Agent.
 *
 * Reconciles the Open-Meteo numerical forecast with NASA POWER satellite
 * observations into one hourly series for the plant's coordinates.
 *
 * Reconciliation is arithmetic, not a language-model call. An LLM was used
 * here previously and it could only return hours it had been shown — the
 * prompt carried the first three, so three hours were all that ever reached
 * the forecaster, and every stored snapshot covered midnight to 02:00 with
 * zero irradiance. Blending two numeric series is a weighted average; doing it
 * in code keeps all N hours, costs nothing, and cannot hallucinate a value.
 */

/** NASA POWER is the cross-check, not the baseline: it corrects, it doesn't lead. */
const OPEN_METEO_WEIGHT = 0.75;
const NASA_WEIGHT = 0.25;

const hourKey = (t) => {
  const d = new Date(t);
  d.setUTCMinutes(0, 0, 0);
  return d.toISOString();
};

/** Weighted blend that tolerates either side being absent. */
function blend(primary, secondary) {
  if (typeof primary !== 'number' || Number.isNaN(primary)) {
    return typeof secondary === 'number' && !Number.isNaN(secondary) ? secondary : null;
  }
  if (typeof secondary !== 'number' || Number.isNaN(secondary)) return primary;
  return Number((primary * OPEN_METEO_WEIGHT + secondary * NASA_WEIGHT).toFixed(2));
}

/**
 * Merge the two sources hour by hour. Open-Meteo drives the series; where NASA
 * POWER covers the same hour, irradiance and wind are blended toward it.
 *
 * @param {Array<object>} openMeteoHourly
 * @param {Array<object>} nasaHourly
 * @returns {Array<object>}
 */
function reconcileHourly(openMeteoHourly = [], nasaHourly = []) {
  const nasaByHour = new Map();
  for (const entry of nasaHourly || []) {
    if (entry?.time) nasaByHour.set(hourKey(entry.time), entry);
  }

  return (openMeteoHourly || []).map((hour) => {
    const nasa = nasaByHour.get(hourKey(hour.time));
    if (!nasa) return hour;
    return {
      ...hour,
      ghiWm2: blend(hour.ghiWm2, nasa.ghiWm2),
      dniWm2: blend(hour.dniWm2, nasa.dniWm2),
      temperatureC: blend(hour.temperatureC, nasa.temperatureC),
      windSpeedMs: blend(hour.windSpeedMs, nasa.windSpeedMs),
    };
  });
}

/**
 * @param {object} plant - Mongoose Plant document (lean)
 * @param {number} hours - Forecast horizon in hours
 * @returns {Promise<object>} Saved WeatherSnapshot document
 */
async function runWeatherReasoningAgent(plant, hours = 72) {
  const start = Date.now();
  logger.info(`[WeatherAgent] Starting for plant ${plant._id} (${plant.name}), horizon=${hours}h`);

  const [openMeteoResult, nasaResult] = await Promise.allSettled([
    openMeteoTool.handler({ latitude: plant.latitude, longitude: plant.longitude, hours, plantType: plant.type }),
    nasaPowerTool.handler({ latitude: plant.latitude, longitude: plant.longitude, hours, plantType: plant.type }),
  ]);

  const openMeteo = openMeteoResult.status === 'fulfilled' ? openMeteoResult.value : null;
  const nasa      = nasaResult.status      === 'fulfilled' ? nasaResult.value      : null;

  if (openMeteoResult.status === 'rejected') {
    logger.error(`[WeatherAgent] Open-Meteo failed: ${openMeteoResult.reason?.message}`);
  }

  const hourly = reconcileHourly(openMeteo?.hourly, nasa?.available ? nasa.hourly : []);

  if (!hourly.length) {
    throw new Error('No weather data available from any source');
  }

  const activeSources = [
    openMeteo?.hourly?.length ? 'open-meteo' : null,
    nasa?.available           ? 'nasa-power' : null,
  ].filter(Boolean);
  const sourceLabel = `${activeSources.join('+') || 'open-meteo'} (reconciled)`;

  const snapshot = await WeatherSnapshot.create({
    plantId:     plant._id,
    source:      sourceLabel,
    hourly,
    generatedAt: new Date(),
  });

  logger.info(
    `[WeatherAgent] Completed in ${Date.now() - start}ms — ${hourly.length} hours ` +
    `from ${sourceLabel}, snapshot ${snapshot._id}`
  );
  return snapshot.toObject();
}

module.exports = { runWeatherReasoningAgent, reconcileHourly };
