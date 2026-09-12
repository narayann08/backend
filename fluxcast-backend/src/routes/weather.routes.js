'use strict';
const express = require('express');
const router = express.Router({ mergeParams: true });
const { identifyUser } = require('../middleware/authMiddleware');
const Plant = require('../models/Plant');
const WeatherSnapshot = require('../models/WeatherSnapshot');
const { runWeatherReasoningAgent } = require('../services/agents/weatherReasoningAgent');
const { summariseCurrent } = require('../services/analytics/weatherService');
const env = require('../config/env');
const logger = require('../utils/logger');

router.use(identifyUser);

/**
 * GET /v1/plants/:plantId/weather
 *
 * Returns the reconciled weather snapshot for a plant's coordinates, along
 * with a `current` summary and a `condition` label for the dashboard map
 * overlay.
 *
 * The Weather-Reasoning Agent calls two external APIs and an LLM, so a stored
 * snapshot is reused while it is younger than WEATHER_CACHE_MINUTES. That keeps
 * the polled dashboard cheap. Pass ?refresh=true to force a fresh agent run.
 */
router.get('/', async (req, res, next) => {
  try {
    const plant = await Plant.findById(req.params.plantId).lean();
    if (!plant) return res.status(404).json({ error: true, message: 'Plant not found' });

    const hours = Math.min(parseInt(req.query.hours, 10) || 72, 72);
    const forceRefresh = req.query.refresh === 'true';

    let snapshot = await WeatherSnapshot.findOne({ plantId: plant._id })
      .sort({ generatedAt: -1 })
      .lean();

    const ageMinutes = snapshot
      ? (Date.now() - new Date(snapshot.generatedAt).getTime()) / 60000
      : Infinity;
    const isStale = ageMinutes > env.WEATHER_CACHE_MINUTES;
    let cached = true;

    if (forceRefresh || isStale) {
      try {
        snapshot = await runWeatherReasoningAgent(plant, hours);
        cached = false;
      } catch (err) {
        // A live-fetch failure should not blank the dashboard if we hold a snapshot.
        logger.error(`[WeatherRoute] Agent run failed for plant ${plant._id}: ${err.message}`);
        if (!snapshot) {
          return res.status(503).json({
            error: true,
            message: 'Weather data is unavailable and no stored snapshot exists for this plant.',
            detail: err.message,
          });
        }
      }
    }

    const { current, condition, conditionLabel } = summariseCurrent(snapshot);

    res.json({
      ...snapshot,
      plantId: plant._id.toString(),
      latitude: plant.latitude,
      longitude: plant.longitude,
      cached,
      ageMinutes: Number.isFinite(ageMinutes) ? Math.round(ageMinutes) : null,
      current,
      condition,
      conditionLabel,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
