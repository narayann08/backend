'use strict';
const Plant = require('../models/Plant');
const Telemetry = require('../models/Telemetry');
const WeatherSnapshot = require('../models/WeatherSnapshot');
const { buildReading, indexWeather } = require('../services/telemetry/mockFeed');
const { scheduleJob } = require('./jobRunner');
const logger = require('../utils/logger');

/**
 * Keeps the measured-output feed current.
 *
 * Without this the only source of telemetry was an operator running
 * `npm run mock:telemetry:catchup` by hand, so "live generation" was whatever
 * had been true the last time someone remembered — in practice hours old, and
 * still labelled live on the dashboard.
 *
 * Readings land every 15 minutes rather than hourly, which is closer to how a
 * real SCADA feed behaves and gives the live panel something that visibly
 * moves. The history chart averages whatever readings fall inside each hour,
 * so a finer cadence costs it nothing.
 */

const SLOT_MINUTES = 15;
const SLOT_MS = SLOT_MINUTES * 60 * 1000;

/** The 15-minute slot an instant belongs to. */
function slotFor(date = new Date()) {
  return new Date(Math.floor(date.getTime() / SLOT_MS) * SLOT_MS);
}

async function recordSlot(slot = slotFor()) {
  const plants = await Plant.find({}).lean();
  let written = 0;

  for (const plant of plants) {
    try {
      // Re-running a slot must not double-count it.
      const existing = await Telemetry.findOne({ plantId: plant._id, timestamp: slot }).lean();
      if (existing) continue;

      const snapshot = await WeatherSnapshot.findOne({ plantId: plant._id, observed: { $ne: true } })
        .sort({ generatedAt: -1 })
        .lean();

      await Telemetry.create(buildReading(plant, slot, indexWeather(snapshot?.hourly)));
      written += 1;
    } catch (err) {
      logger.error(`[TelemetryJob] Failed for plant ${plant._id}: ${err.message}`);
    }
  }

  logger.info(`[TelemetryJob] ${written} reading(s) written for ${slot.toISOString()}`);
  return written;
}

/**
 * Two minutes past each quarter: after the weather pull that prices the
 * reading, before the forecast run that consumes it.
 */
function startTelemetryJob() {
  return scheduleJob({
    name: 'TelemetryJob',
    expression: '2,17,32,47 * * * *',
    task: () => recordSlot(),
    startDelayMs: 20_000,
  });
}

module.exports = { startTelemetryJob, recordSlot, slotFor, SLOT_MINUTES };
