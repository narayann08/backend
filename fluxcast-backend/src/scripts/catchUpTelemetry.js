'use strict';
require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../config/db');
const logger = require('../utils/logger');
const Plant = require('../models/Plant');
const Telemetry = require('../models/Telemetry');
const { istHourOfDay } = require('../utils/istTime');

/**
 * Extend the mock SCADA telemetry feed from each plant's last stored reading
 * up to the current hour.
 *
 * FluxCast has no live SCADA integration, so `seed.js` lays down mock readings
 * at install time. Those go stale the moment seeding finishes, which leaves the
 * dashboard's "live generation" panel and the forecast-vs-actual history chart
 * without recent data to work with. Run this to top the feed back up.
 *
 * Uses the same generation curves as `seed.js` so the series stays continuous.
 */

/** Hourly generation for a plant, mirroring the curves used by seed.js. */
function mockGenerationMW(plant, timestamp) {
  const hourOfDay = istHourOfDay(timestamp); // every plant is in India — IST, not UTC

  if (plant.type === 'solar') {
    // Daylight curve between 06:00 and 18:00 IST, zero overnight.
    if (hourOfDay < 6 || hourOfDay > 18) return 0;
    const peakFactor = Math.sin(((hourOfDay - 6) / 12) * Math.PI);
    return Math.max(0, plant.capacityMW * 0.85 * peakFactor + (Math.random() * 10 - 5));
  }

  // Wind: diurnal variation around a 40% baseline.
  const windFactor = 0.4 + 0.3 * Math.cos((hourOfDay / 24) * 2 * Math.PI) + (Math.random() * 0.2 - 0.1);
  return Math.max(0, Math.min(plant.capacityMW, plant.capacityMW * windFactor));
}

/** Cap how far back a single run will backfill, so a long-idle DB can't flood. */
const MAX_BACKFILL_HOURS = 24 * 14;

async function catchUpTelemetry() {
  try {
    await connectDB();
    const plants = await Plant.find({}).lean();
    const now = new Date();
    now.setUTCMinutes(0, 0, 0);

    let totalInserted = 0;

    for (const plant of plants) {
      const last = await Telemetry.findOne({ plantId: plant._id })
        .sort({ timestamp: -1 })
        .lean();

      // Start one hour after the last reading, or 48h back for an empty plant.
      let cursor = last
        ? new Date(new Date(last.timestamp).getTime() + 3600 * 1000)
        : new Date(now.getTime() - 48 * 3600 * 1000);
      cursor.setUTCMinutes(0, 0, 0);

      const earliestAllowed = new Date(now.getTime() - MAX_BACKFILL_HOURS * 3600 * 1000);
      if (cursor < earliestAllowed) cursor = earliestAllowed;

      const batch = [];
      while (cursor <= now) {
        batch.push({
          plantId: plant._id,
          timestamp: new Date(cursor),
          generationMW: Math.round(mockGenerationMW(plant, cursor) * 10) / 10,
          sensorStatus: Math.random() < 0.03 ? 'degraded' : 'ok',
          outage: false,
        });
        cursor = new Date(cursor.getTime() + 3600 * 1000);
      }

      if (!batch.length) {
        logger.info(`[CatchUpTelemetry] ${plant.name}: already current`);
        continue;
      }

      await Telemetry.insertMany(batch);
      totalInserted += batch.length;
      logger.info(
        `[CatchUpTelemetry] ${plant.name}: inserted ${batch.length} readings ` +
        `(${batch[0].timestamp.toISOString()} -> ${batch[batch.length - 1].timestamp.toISOString()})`
      );
    }

    logger.info(`[CatchUpTelemetry] Done — ${totalInserted} readings inserted across ${plants.length} plants`);
  } catch (err) {
    logger.error('[CatchUpTelemetry] Failed:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

catchUpTelemetry();
