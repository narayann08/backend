'use strict';
const mongoose = require('mongoose');

const plantSchema = new mongoose.Schema(
  {
    name:             { type: String, required: true, trim: true },
    type:             { type: String, enum: ['solar', 'wind'], required: true },
    latitude:         { type: Number, required: true },
    longitude:        { type: Number, required: true },
    capacityMW:       { type: Number, required: true },
    commissionedDate: { type: Date },
    solarSpec: {
      panelTiltDeg:    Number,
      panelAzimuthDeg: Number,
    },
    windSpec: {
      hubHeightM:      Number,
      rotorDiameterM:  Number,
    },
    hasLimitedHistory: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const Plant = mongoose.model('Plant', plantSchema);
module.exports = Plant;
