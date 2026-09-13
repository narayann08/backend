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
    /*
     * True for weather that was recorded rather than predicted — hours already
     * past, fetched to calibrate the generation model against stored telemetry.
     * `generatedAt` on such a document is when it was *written*, not the period
     * it covers, so anything answering "what are conditions now" must exclude
     * these or it will serve last week's sky as the current one.
     */
    observed:    { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

const WeatherSnapshot = mongoose.model('WeatherSnapshot', weatherSnapshotSchema);
module.exports = WeatherSnapshot;
