'use strict';
const mongoose = require('mongoose');

const recommendationSchema = new mongoose.Schema(
  {
    plantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plant', required: true },
    generatedAt: { type: Date, default: Date.now },
    action: {
      type: String,
      enum: ['charge_battery', 'discharge_battery', 'curtail', 'export', 'activate_backup', 'hold'],
      required: true,
    },
    amountMW:             Number,
    durationHours:        Number,
    reasoning:            String,
    constraintsConsidered: [String],
    forecastResultId:     { type: mongoose.Schema.Types.ObjectId, ref: 'ForecastResult' },
  },
  { timestamps: true }
);

recommendationSchema.index({ plantId: 1, generatedAt: -1 });

const Recommendation = mongoose.model('Recommendation', recommendationSchema);
module.exports = Recommendation;
