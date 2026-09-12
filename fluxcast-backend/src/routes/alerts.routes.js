'use strict';
const express = require('express');
const router = express.Router();
const { identifyUser } = require('../middleware/authMiddleware');
const Alert = require('../models/Alert');

router.use(identifyUser);

/**
 * GET /v1/alerts
 * List active alerts, filterable by severity or plantId.
 */
router.get('/', async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.severity) filter.severity = req.query.severity;
    if (req.query.plantId)  filter.plantId  = req.query.plantId;
    const alerts = await Alert.find(filter).sort({ createdAt: -1 }).lean();
    res.json(alerts.map(a => ({ ...a, id: a._id, plantId: a.plantId.toString() })));
  } catch (err) {
    next(err);
  }
});

/**
 * POST /v1/alerts/:alertId/acknowledge
 * Marks an alert as seen/handled by an operator.
 */
router.post('/:alertId/acknowledge', async (req, res, next) => {
  try {
    const alert = await Alert.findByIdAndUpdate(
      req.params.alertId,
      { acknowledged: true, acknowledgedAt: new Date() },
      { new: true }
    ).lean();
    if (!alert) return res.status(404).json({ error: true, message: 'Alert not found' });
    res.json({ ...alert, id: alert._id, plantId: alert.plantId.toString() });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
