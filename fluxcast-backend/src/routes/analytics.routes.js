'use strict';
const express = require('express');
const router = express.Router({ mergeParams: true });
const { identifyUser } = require('../middleware/authMiddleware');
const Plant = require('../models/Plant');
const Telemetry = require('../models/Telemetry');
const { evaluatePlantPerformance } = require('../services/analytics/performanceService');
const { buildHistorySeries } = require('../services/analytics/historyService');

router.use(identifyUser);

/** Load the plant or answer 404. */
async function loadPlant(plantId, res) {
  const plant = await Plant.findById(plantId).lean();
  if (!plant) {
    res.status(404).json({ error: true, message: 'Plant not found' });
    return null;
  }
  return plant;
}

/**
 * GET /v1/plants/:plantId/generation/live
 * Latest measured output for the plant, with the forecast baseline for the
 * same hour so the dashboard can show actual-vs-expected at a glance.
 */
router.get('/generation/live', async (req, res, next) => {
  try {
    const plant = await loadPlant(req.params.plantId, res);
    if (!plant) return;

    const latest = await Telemetry.findOne({ plantId: plant._id })
      .sort({ timestamp: -1 })
      .lean();

    if (!latest) {
      return res.status(404).json({ error: true, message: 'No telemetry recorded for this plant yet' });
    }

    const performance = await evaluatePlantPerformance(plant);

    res.json({
      plantId: plant._id.toString(),
      plantName: plant.name,
      timestamp: latest.timestamp,
      generationMW: latest.generationMW,
      capacityMW: plant.capacityMW,
      capacityFactorPct: performance.capacityFactorPct,
      sensorStatus: latest.sensorStatus,
      outage: latest.outage,
      expectedMW: performance.expectedMW,
      deltaMW: performance.deltaMW,
      deltaPct: performance.deltaPct,
      classification: performance.classification,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /v1/plants/:plantId/performance
 * Classifies current output as lower / usual / higher against the latest
 * cron-generated forecast, and attributes any shortfall to concrete causes
 * derived from telemetry and the stored weather snapshot.
 */
router.get('/performance', async (req, res, next) => {
  try {
    const plant = await loadPlant(req.params.plantId, res);
    if (!plant) return;
    res.json(await evaluatePlantPerformance(plant));
  } catch (err) {
    next(err);
  }
});

/**
 * GET /v1/plants/:plantId/history?from=&to=
 * Hourly forecast-vs-actual generation plus prediction confidence over a date
 * range. Defaults to the last 7 days when no range is supplied.
 */
router.get('/history', async (req, res, next) => {
  try {
    const plant = await loadPlant(req.params.plantId, res);
    if (!plant) return;

    const to = req.query.to ? new Date(req.query.to) : new Date();
    const from = req.query.from
      ? new Date(req.query.from)
      : new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return res.status(400).json({ error: true, message: 'Invalid from/to date' });
    }
    if (from > to) {
      return res.status(400).json({ error: true, message: '"from" must be earlier than "to"' });
    }

    const { points, summary } = await buildHistorySeries(plant._id, from, to);

    res.json({
      plantId: plant._id.toString(),
      plantName: plant.name,
      plantType: plant.type,
      capacityMW: plant.capacityMW,
      from,
      to,
      points,
      summary,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
