'use strict';
const Plant = require('../models/Plant');
const WeatherSnapshot = require('../models/WeatherSnapshot');
const { runWeatherReasoningAgent } = require('../services/agents/weatherReasoningAgent');
const { fetchObservedWeather } = require('../services/connectors/openMeteoConnector');
const { scheduleJob } = require('./jobRunner');
const logger = require('../utils/logger');

/** Forecast horizon to pull and store for every plant. */
const HORIZON_HOURS = 72;

/** How long a forecast snapshot is worth keeping once newer ones exist. */
const SNAPSHOT_RETENTION_HOURS = 6;

/**
 * How stale the observed-weather record may get. It is what the generation
 * model calibrates against, so it has to keep pace with incoming telemetry —
 * otherwise the newest readings have no conditions to be paired with.
 */
const OBSERVED_REFRESH_HOURS = 6;
const OBSERVED_WINDOW_DAYS = 14;
const OBSERVED_SOURCE = 'open-meteo (observed history)';

const HOUR_MS = 3600 * 1000;

/**
 * Keep the observed-weather record current, without re-pulling it every cycle.
 * Cheap to check, and a no-op on most runs.
 */
async function refreshObservedWeather(plant) {
  const existing = await WeatherSnapshot.findOne({ plantId: plant._id, observed: true })
    .sort({ generatedAt: -1 })
    .lean();

  const ageHours = existing ? (Date.now() - new Date(existing.generatedAt).getTime()) / HOUR_MS : Infinity;
  if (ageHours < OBSERVED_REFRESH_HOURS) return false;

  const hourly = await fetchObservedWeather(
    plant.latitude,
    plant.longitude,
    OBSERVED_WINDOW_DAYS,
    plant.type
  );
  if (!hourly.length) return false;

  await WeatherSnapshot.deleteMany({ plantId: plant._id, observed: true });
  await WeatherSnapshot.create({
    plantId: plant._id,
    source: OBSERVED_SOURCE,
    hourly,
    observed: true,
    generatedAt: new Date(),
  });
  return true;
}

/**
 * Drop superseded forecast snapshots. At a 15-minute cadence these arrive 96
 * times a day per plant, and only the newest is ever served — the calibration
 * history lives in the observed record instead, which is the accurate source
 * for it anyway.
 */
async function pruneSupersededSnapshots(plant) {
  const { deletedCount } = await WeatherSnapshot.deleteMany({
    plantId: plant._id,
    observed: { $ne: true },
    generatedAt: { $lt: new Date(Date.now() - SNAPSHOT_RETENTION_HOURS * HOUR_MS) },
  });
  return deletedCount;
}

async function pullWeather() {
  const plants = await Plant.find({}).lean();
  let pulled = 0;
  let refreshed = 0;
  let pruned = 0;

  for (const plant of plants) {
    try {
      await runWeatherReasoningAgent(plant, HORIZON_HOURS);
      pulled += 1;
      if (await refreshObservedWeather(plant)) refreshed += 1;
      pruned += await pruneSupersededSnapshots(plant);
    } catch (err) {
      logger.error(`[WeatherPullJob] Failed for plant ${plant._id}: ${err.message}`);
    }
  }

  logger.info(
    `[WeatherPullJob] ${pulled}/${plants.length} snapshots, ` +
    `${refreshed} observed record(s) refreshed, ${pruned} superseded pruned`
  );
}

/** Every 15 minutes, and once at start-up. First in the cycle: everything else reads its output. */
function startWeatherPullJob() {
  return scheduleJob({
    name: 'WeatherPullJob',
    expression: '0,15,30,45 * * * *',
    task: pullWeather,
  });
}

module.exports = { startWeatherPullJob, pullWeather, SNAPSHOT_RETENTION_HOURS, OBSERVED_REFRESH_HOURS };
