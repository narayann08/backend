'use strict';
const express = require('express');
const router = express.Router();
const Plant = require('../models/Plant');
const Telemetry = require('../models/Telemetry');
const { identifyUser, requireRole } = require('../middleware/authMiddleware');

router.use(identifyUser);

/**
 * GET /v1/plants
 * List all plants, filterable by type, with pagination.
 */
router.get('/', async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.type) filter.type = req.query.type;
    const page  = parseInt(req.query.page, 10)  || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip  = (page - 1) * limit;

    const [plants, total] = await Promise.all([
      Plant.find(filter).skip(skip).limit(limit).lean(),
      Plant.countDocuments(filter),
    ]);

    res.json({ total, plants: plants.map(p => ({ ...p, id: p._id })) });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /v1/plants
 * Register a new plant.
 */
router.post('/', async (req, res, next) => {
  try {
    const plant = await Plant.create(req.body);
    res.status(201).json({ ...plant.toObject(), id: plant._id });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /v1/plants/:plantId
 * Get a single plant's details.
 */
router.get('/:plantId', async (req, res, next) => {
  try {
    const plant = await Plant.findById(req.params.plantId).lean();
    if (!plant) return res.status(404).json({ error: true, message: 'Plant not found' });
    res.json({ ...plant, id: plant._id });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /v1/plants/:plantId
 * Update plant metadata.
 */
router.patch('/:plantId', async (req, res, next) => {
  try {
    const plant = await Plant.findByIdAndUpdate(
      req.params.plantId,
      req.body,
      { new: true, runValidators: true }
    ).lean();
    if (!plant) return res.status(404).json({ error: true, message: 'Plant not found' });
    res.json({ ...plant, id: plant._id });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /v1/plants/:plantId
 * Remove a plant. Restricted to admin and utility_admin.
 */
router.delete('/:plantId', requireRole('admin', 'utility_admin'), async (req, res, next) => {
  try {
    const plant = await Plant.findByIdAndDelete(req.params.plantId);
    if (!plant) return res.status(404).json({ error: true, message: 'Plant not found' });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

/**
 * GET /v1/plants/:plantId/telemetry
 * Returns last N days of actual generation + sensor data.
 */
router.get('/:plantId/telemetry', async (req, res, next) => {
  try {
    const days  = parseInt(req.query.days, 10) || 4;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const data  = await Telemetry
      .find({ plantId: req.params.plantId, timestamp: { $gte: since } })
      .sort({ timestamp: 1 })
      .lean();
    res.json(data.map(d => ({
      timestamp:    d.timestamp,
      generationMW: d.generationMW,
      sensorStatus: d.sensorStatus,
      outage:       d.outage,
    })));
  } catch (err) {
    next(err);
  }
});

/**
 * POST /v1/plants/:plantId/telemetry
 * Ingest a new SCADA/inverter reading.
 */
router.post('/:plantId/telemetry', async (req, res, next) => {
  try {
    const doc = await Telemetry.create({ plantId: req.params.plantId, ...req.body });
    res.status(201).json({
      timestamp:    doc.timestamp,
      generationMW: doc.generationMW,
      sensorStatus: doc.sensorStatus,
      outage:       doc.outage,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
