'use strict';
const cron = require('node-cron');
const Plant = require('../models/Plant');
const { runWeatherReasoningAgent } = require('../services/agents/weatherReasoningAgent');
const logger = require('../utils/logger');

/**
 * Starts the scheduled weather pull job.
 * Runs every 3 hours for all registered plants.
 * Snapshots are stored in DB for reuse by the Forecasting Agent.
 */
function startWeatherPullJob() {
  cron.schedule('0 */3 * * *', async () => {
    logger.info('[WeatherPullJob] Scheduled run starting');
    let plants;
    try {
      plants = await Plant.find({}).lean();
    } catch (err) {
      logger.error('[WeatherPullJob] Failed to fetch plants:', err.message);
      return;
    }

    for (const plant of plants) {
      try {
        await runWeatherReasoningAgent(plant, 72);
        logger.info(`[WeatherPullJob] Snapshot saved for plant ${plant._id}`);
      } catch (err) {
        logger.error(`[WeatherPullJob] Failed for plant ${plant._id}:`, err.message);
      }
    }
  });

  logger.info('[WeatherPullJob] Scheduled (runs every 3 hours)');
}

module.exports = { startWeatherPullJob };
