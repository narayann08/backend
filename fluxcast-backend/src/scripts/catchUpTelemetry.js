'use strict';
require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../config/db');
const logger = require('../utils/logger');
const Plant = require('../models/Plant');
const Telemetry = require('../models/Telemetry');
const WeatherSnapshot = require('../models/WeatherSnapshot');
const { buildReading, indexWeather } = require('../services/telemetry/mockFeed');

/**
 * Extend the mock SCADA telemetry feed from each plant's last stored reading
 * up to the current hour.
 *
 * FluxCast has no live SCADA integration, so `seed.js` lays down mock readings
 * at install time. Those go stale the moment seeding finishes, which leaves the
 * dashboard's "live generation" panel and the forecast-vs-actual history chart
 * without recent data to work with. Run this to top the feed back up.
 *
 * Readings come from the same weather-driven feed the hourly telemetry job
 * uses, so a backfilled stretch is indistinguishable from a live one.
 *
 * With that job running this script is a repair tool rather than routine
 * maintenance — reach for it after the server has been down.
 */

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

      // Every snapshot held for this plant, so backfilled hours are priced
      // against the weather that was actually forecast for them.
      const snapshots = await WeatherSnapshot.find({ plantId: plant._id })
        .sort({ generatedAt: 1 })
        .lean();
      const weatherByHour = indexWeather(snapshots.flatMap((s) => s.hourly || []));

      const batch = [];
      while (cursor <= now) {
        batch.push(buildReading(plant, cursor, weatherByHour));
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
