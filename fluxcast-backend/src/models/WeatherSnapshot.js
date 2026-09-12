'use strict';
const mongoose = require('mongoose');

const hourlyEntrySchema = new mongoose.Schema(
  {
    time:               Date,
    cloudCoverPct:      Number,
    ghiWm2:             Number,
    dniWm2:             Number,
    rainProbabilityPct: Number,
    temperatureC:       Number,
    humidityPct:        Number,
    windSpeedMs:        Number,
    windDirectionDeg:   Number,
    windGustMs:         Number,
    turbulenceIndex:    Number,
  },
  { _id: false }
);

const weatherSnapshotSchema = new mongoose.Schema(
  {
    plantId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Plant', required: true, index: true },
    source:      { type: String, default: 'open-meteo+nasa-power (reconciled)' },
    hourly:      [hourlyEntrySchema],
    generatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const WeatherSnapshot = mongoose.model('WeatherSnapshot', weatherSnapshotSchema);
module.exports = WeatherSnapshot;
