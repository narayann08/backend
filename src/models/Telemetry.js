'use strict';
const mongoose = require('mongoose');

const telemetrySchema = new mongoose.Schema(
  {
    plantId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Plant', required: true },
    timestamp:    { type: Date, required: true },
    generationMW: { type: Number, required: true },
    sensorStatus: { type: String, enum: ['ok', 'degraded', 'offline'], default: 'ok' },
    outage:       { type: Boolean, default: false },
  },
  { timestamps: false }
);

// Compound index for fast recent-history lookups
telemetrySchema.index({ plantId: 1, timestamp: -1 });

const Telemetry = mongoose.model('Telemetry', telemetrySchema);
module.exports = Telemetry;
