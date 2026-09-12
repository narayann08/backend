'use strict';
const express = require('express');
const router = express.Router({ mergeParams: true });
const { identifyUser } = require('../middleware/authMiddleware');
const ForecastResult = require('../models/ForecastResult');
const Plant = require('../models/Plant');
const { runForecastWorkflow } = require('../services/graph/forecastWorkflow');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const rateLimit = require('express-rate-limit');

router.use(identifyUser);

// Rate-limit fresh forecast triggers (LLM calls are expensive)
const forecastTriggerLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: true, message: 'Too many forecast requests, please wait.' },
});

/**
 * GET /v1/plants/:plantId/forecast
 * Returns the most recently generated forecast for the requested horizon.
 */
router.get('/', async (req, res, next) => {
  try {
    const horizon = parseInt(req.query.horizon, 10) || 24;
    const forecast = await ForecastResult
      .findOne({ plantId: req.params.plantId, horizonHours: horizon })
      .sort({ generatedAt: -1 })
      .lean();
    if (!forecast) return res.status(404).json({ error: true, message: 'No forecast found' });
    res.json({ ...forecast, plantId: forecast.plantId.toString() });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /v1/plants/:plantId/forecast
 * Triggers a fresh run of the full agent workflow for this plant (async).
 * Returns a jobId immediately — workflow runs in background.
 */
router.post('/', forecastTriggerLimiter, async (req, res, next) => {
  try {
    const plant = await Plant.findById(req.params.plantId).lean();
    if (!plant) return res.status(404).json({ error: true, message: 'Plant not found' });

    const horizon = (req.body && req.body.horizon) || 24;
    const jobId = uuidv4();

    // Fire-and-forget background workflow
    setImmediate(async () => {
      try {
        await runForecastWorkflow({ plant, horizon, jobId });
        logger.info(`[ForecastRoute] Background workflow complete for jobId ${jobId}`);
      } catch (e) {
        logger.error(`[ForecastRoute] Background workflow failed for jobId ${jobId}:`, e.message);
      }
    });

    res.status(202).json({ jobId, status: 'queued' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
