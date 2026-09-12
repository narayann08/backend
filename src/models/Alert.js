'use strict';
const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema(
  {
    plantId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Plant', required: true, index: true },
    severity: { type: String, enum: ['low', 'medium', 'high'], required: true },
    type: {
      type: String,
      enum: ['curtailment_risk', 'shortfall_risk', 'storage_limit', 'sensor_fault', 'extreme_weather'],
      required: true,
    },
    message:        { type: String, required: true },
    acknowledged:   { type: Boolean, default: false },
    acknowledgedAt: Date,
  },
  { timestamps: true }
);

const Alert = mongoose.model('Alert', alertSchema);
module.exports = Alert;
