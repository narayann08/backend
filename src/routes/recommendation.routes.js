'use strict';
const express = require('express');
const router = express.Router({ mergeParams: true });
const { authMiddleware } = require('../middleware/authMiddleware');
const Recommendation = require('../models/Recommendation');

router.use(authMiddleware);

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
