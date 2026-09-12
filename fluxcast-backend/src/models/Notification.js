'use strict';
const mongoose = require('mongoose');

/**
 * Audit trail of outbound notifications raised from alerts. One document per
 * delivery attempt, so the dashboard can show what was sent, to whom, and why
 * a send was skipped.
 */
const notificationSchema = new mongoose.Schema(
  {
    alertId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Alert', required: true, index: true },
    plantId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Plant', required: true, index: true },
    channel:  { type: String, enum: ['socket', 'email'], required: true },
    status:   { type: String, enum: ['sent', 'skipped', 'failed'], required: true },
    recipient: { type: String },
    severity: { type: String, enum: ['low', 'medium', 'high'] },
    type:     { type: String },
    subject:  { type: String },
    detail:   { type: String },
  },
  { timestamps: true }
);

notificationSchema.index({ createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);
module.exports = Notification;
