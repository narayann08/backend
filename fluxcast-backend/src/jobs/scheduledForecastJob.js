'use strict';
const cron = require('node-cron');
const Plant = require('../models/Plant');
const { runForecastWorkflow } = require('../services/graph/forecastWorkflow');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

/**
 * Starts the scheduled forecast job.
 * Runs at :05 past each hour for every registered plant.
 * Each plant gets a 24-hour horizon forecast.
 */
function startForecastJob() {
  cron.schedule('5 * * * *', async () => {
    logger.info('[ForecastJob] Scheduled run starting');
    let plants;
    try {
      plants = await Plant.find({}).lean();
    } catch (err) {
      logger.error('[ForecastJob] Failed to fetch plants:', err.message);
      return;
    }

    for (const plant of plants) {
      try {
        await runForecastWorkflow({ plant, horizon: 24, jobId: uuidv4() });
        logger.info(`[ForecastJob] Completed for plant ${plant._id}`);
      } catch (err) {
        logger.error(`[ForecastJob] Failed for plant ${plant._id}:`, err.message);
      }
    }
  });

  logger.info('[ForecastJob] Scheduled (runs at :05 each hour)');
}

module.exports = { startForecastJob };
