'use strict';
const express = require('express');
const router = express.Router();
const { identifyUser } = require('../middleware/authMiddleware');
const Notification = require('../models/Notification');
const { isConfigured } = require('../services/notifications/emailDispatcher');

router.use(identifyUser);

/**
 * GET /v1/notifications
 * Delivery log for alert notifications (socket push and email escalation).
 * Read-only: sending is handled entirely by the backend when an alert fires.
 *
 * Query: plantId, channel (socket|email), status (sent|skipped|failed), limit
 */
router.get('/', async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.plantId) filter.plantId = req.query.plantId;
    if (req.query.channel) filter.channel = req.query.channel;
    if (req.query.status)  filter.status  = req.query.status;

    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.json({
      emailConfigured: isConfigured(),
      total: notifications.length,
      notifications: notifications.map(n => ({
        ...n,
        id: n._id,
        plantId: n.plantId.toString(),
        alertId: n.alertId.toString(),
      })),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
