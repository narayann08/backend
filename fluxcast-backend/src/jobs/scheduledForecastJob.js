'use strict';
const Plant = require('../models/Plant');
const { runForecastWorkflow } = require('../services/graph/forecastWorkflow');
const { scheduleJob } = require('./jobRunner');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

/**
 * Runs the four-agent workflow for every plant.
 *
 * Note the cost shape: the forecast itself is arithmetic, but the decision and
 * explainability steps each call a language model, so one cycle is two model
 * calls per plant. At a 15-minute cadence that is eight times an hour per
 * plant — worth knowing before adding plants to the fleet.
 */
const HORIZON_HOURS = 24;

async function runForecasts() {
  const plants = await Plant.find({}).lean();
  let completed = 0;

  for (const plant of plants) {
    try {
      await runForecastWorkflow({ plant, horizon: HORIZON_HOURS, jobId: uuidv4() });
      completed += 1;
    } catch (err) {
      logger.error(`[ForecastJob] Failed for plant ${plant._id}: ${err.message}`);
    }
  }

  logger.info(`[ForecastJob] ${completed}/${plants.length} plants forecast`);
}

/** Five past each quarter — last in the cycle, once weather and telemetry are in. */
function startForecastJob() {
  return scheduleJob({
    name: 'ForecastJob',
    expression: '5,20,35,50 * * * *',
    task: runForecasts,
    startDelayMs: 40_000,
  });
}

module.exports = { startForecastJob, runForecasts };
