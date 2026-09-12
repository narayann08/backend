'use strict';
const express = require('express');
const router = express.Router({ mergeParams: true });
const { identifyUser } = require('../middleware/authMiddleware');
const Recommendation = require('../models/Recommendation');

router.use(identifyUser);

/**
 * GET /v1/plants/:plantId/recommendation
 * Returns the Decision Agent's latest suggested action for a plant.
 */
router.get('/recommendation', async (req, res, next) => {
  try {
    const rec = await Recommendation
      .findOne({ plantId: req.params.plantId })
      .sort({ generatedAt: -1 })
      .lean();
    if (!rec) return res.status(404).json({ error: true, message: 'No recommendation found' });
    res.json({ ...rec, plantId: rec.plantId.toString() });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /v1/plants/:plantId/recommendations
 * Recent AI recommendations for this plant, newest first — the feed behind the
 * decisions notice board.
 *
 * Query: limit (default 20, max 100)
 */
router.get('/recommendations', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const recs = await Recommendation
      .find({ plantId: req.params.plantId })
      .sort({ generatedAt: -1 })
      .limit(limit)
      .lean();

    res.json({
      plantId: req.params.plantId,
      total: recs.length,
      recommendations: recs.map(r => ({
        ...r,
        id: r._id,
        plantId: r.plantId.toString(),
      })),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /v1/plants/:plantId/explain
 * Returns the Explainability Agent's plain-language summary of the latest
 * forecast/recommendation for the dashboard root-cause panel.
 */
router.get('/explain', async (req, res, next) => {
  try {
    const rec = await Recommendation
      .findOne({ plantId: req.params.plantId })
      .sort({ generatedAt: -1 })
      .lean();
    if (!rec) return res.status(404).json({ error: true, message: 'No explanation available yet' });
    res.json({
      summary: rec.reasoning || 'No explanation generated yet.',
      factors: rec.constraintsConsidered || [],
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
