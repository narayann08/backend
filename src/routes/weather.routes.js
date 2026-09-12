'use strict';
const express = require('express');
const router = express.Router({ mergeParams: true });
const { authMiddleware } = require('../middleware/authMiddleware');
const Plant = require('../models/Plant');
const { runWeatherReasoningAgent } = require('../services/agents/weatherReasoningAgent');

router.use(authMiddleware);

/**
 * GET /v1/plants/:plantId/weather
 * Returns reconciled weather data for a plant's coordinates,
 * produced by the Weather-Reasoning Agent.
 */
router.get('/', async (req, res, next) => {
  try {
    const plant = await Plant.findById(req.params.plantId).lean();
    if (!plant) return res.status(404).json({ error: true, message: 'Plant not found' });
    const hours = Math.min(parseInt(req.query.hours, 10) || 72, 72);
    const snapshot = await runWeatherReasoningAgent(plant, hours);
    res.json(snapshot);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
