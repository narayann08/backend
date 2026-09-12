'use strict';
const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { authMiddleware } = require('../middleware/authMiddleware');
const Plant = require('../models/Plant');
const { runForecastWorkflow } = require('../services/graph/forecastWorkflow');

router.use(authMiddleware);

// Strict rate limit — simulation triggers LLM calls and external API hits
const simulateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: true, message: 'Too many simulation requests. Please wait 60 seconds.' },
});

/**
 * POST /v1/simulate
 * Re-runs the agent workflow with overridden assumptions (demand spike, plant outage, etc.)
 * without touching stored forecasts. Used for what-if analysis.
 */
router.post('/', simulateLimiter, async (req, res, next) => {
  try {
    const { plantId, scenario, overrides } = req.body;
    const plant = await Plant.findById(plantId).lean();
    if (!plant) return res.status(404).json({ error: true, message: 'Plant not found' });

    const result = await runForecastWorkflow({
      plant,
      horizon: 24,
      simulationMode: true,
      scenario,
      overrides,
    });

    res.json({
      scenario,
      forecast:       result.forecast,
      recommendation: result.recommendation,
      explanation:    result.explanation,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
