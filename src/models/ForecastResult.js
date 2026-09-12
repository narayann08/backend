'use strict';
const mongoose = require('mongoose');

const forecastPointSchema = new mongoose.Schema(
  {
    time:           Date,
    expectedMW:     Number,
    lowerBoundMW:   Number,
    upperBoundMW:   Number,
    confidencePct:  Number,
  },
  { _id: false }
);

const riskWindowSchema = new mongoose.Schema(
  {
    start: Date,
    end:   Date,
    type:  {
      type: String,
      enum: ['over_generation', 'under_generation', 'operational_risk'],
    },
  },
  { _id: false }
);

const forecastResultSchema = new mongoose.Schema(
  {
    plantId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Plant', required: true },
    generatedAt:  { type: Date, default: Date.now },
    horizonHours: { type: Number, enum: [24, 48, 72], default: 24 },
    points:       [forecastPointSchema],
    riskWindows:  [riskWindowSchema],
    jobId:        { type: String },
  },
  { timestamps: true }
);

forecastResultSchema.index({ plantId: 1, generatedAt: -1 });

const ForecastResult = mongoose.model('ForecastResult', forecastResultSchema);
module.exports = ForecastResult;
