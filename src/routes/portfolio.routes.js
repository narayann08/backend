'use strict';
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const ForecastResult = require('../models/ForecastResult');
const Plant = require('../models/Plant');

router.use(authMiddleware);

/**
 * GET /v1/portfolio/forecast
 * Aggregates forecasts across selected (or all) plants into a single combined view.
 * Utility-company users use this to see the combined supply picture.
 */
router.get('/forecast', async (req, res, next) => {
  try {
    const horizon = parseInt(req.query.horizon, 10) || 24;

    let plantIds;
    if (req.query.plantIds) {
      plantIds = req.query.plantIds.split(',').map(id => id.trim());
    } else {
      const plants = await Plant.find({}).select('_id').lean();
      plantIds = plants.map(p => p._id.toString());
    }

    // Fetch latest forecast for each plant in parallel
    const forecasts = await Promise.all(
      plantIds.map(pid =>
        ForecastResult
          .findOne({ plantId: pid, horizonHours: horizon })
          .sort({ generatedAt: -1 })
          .lean()
      )
    );

    const validForecasts = forecasts.filter(Boolean);
    if (!validForecasts.length) {
      return res.json({
        generatedAt:    new Date(),
        horizonHours:   horizon,
        totalExpectedMW: [],
        plantBreakdown:  [],
      });
    }

    // Aggregate time series: sum MW across all plants per timestamp
    const timeMap = {};
    const plantBreakdown = [];

    for (const fc of validForecasts) {
      let plantTotal = 0;
      for (const pt of fc.points || []) {
        const key = new Date(pt.time).toISOString();
        if (!timeMap[key]) {
          timeMap[key] = { time: pt.time, expectedMW: 0, lowerBoundMW: 0, upperBoundMW: 0 };
        }
        timeMap[key].expectedMW    += pt.expectedMW    || 0;
        timeMap[key].lowerBoundMW  += pt.lowerBoundMW  || 0;
        timeMap[key].upperBoundMW  += pt.upperBoundMW  || 0;
        plantTotal += pt.expectedMW || 0;
      }
      plantBreakdown.push({ plantId: fc.plantId.toString(), expectedMW: plantTotal });
    }

    const totalExpectedMW = Object.values(timeMap)
      .sort((a, b) => new Date(a.time) - new Date(b.time));

    res.json({ generatedAt: new Date(), horizonHours: horizon, totalExpectedMW, plantBreakdown });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
