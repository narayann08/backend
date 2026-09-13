'use strict';
require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../config/db');
const logger = require('../utils/logger');
const Plant = require('../models/Plant');
const Telemetry = require('../models/Telemetry');
const WeatherSnapshot = require('../models/WeatherSnapshot');
const { fetchObservedWeather } = require('../services/connectors/openMeteoConnector');
const { calibrate } = require('../services/forecast/generationModel');

/**
 * Record what the weather actually was over the stretch of stored telemetry.
 *
 * The forecaster scales its physics by a factor fitted on the plant's own
 * output against the conditions that produced it. That fit needs both halves:
 * readings, which are stored, and the weather for those same hours, which
 * normally only exists as the forecasts that were live at the time. After a
 * data wipe — or on a fresh deployment with imported history — those forecasts
 * are gone and the model runs uncalibrated until a day or so of new snapshots
 * has aged into the past.
 *
 * This fills that gap from Open-Meteo's record of past days. The documents are
 * written with `observed: true` and a source that says so, and every query that
 * answers "what are conditions now" filters them out — they exist only to be
 * paired with telemetry.
 *
 *   node src/scripts/backfillObservedWeather.js [--days 14] [--apply]
 *
 * Without --apply it reports what it would write and what the fit would become.
 */

const SOURCE = 'open-meteo (observed history)';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

async function backfillObservedWeather() {
  const days = Math.max(1, Math.min(parseInt(arg('days', '14'), 10) || 14, 92));
  const apply = process.argv.includes('--apply');

  try {
    await connectDB();
    const plants = await Plant.find({}).lean();
    logger.info(
      `[BackfillWeather] ${apply ? 'Writing' : 'Dry run —'} ${days} days of observed weather ` +
      `for ${plants.length} plant(s)`
    );

    for (const plant of plants) {
      const [hourly, telemetry, existing] = await Promise.all([
        fetchObservedWeather(plant.latitude, plant.longitude, days, plant.type),
        Telemetry.find({ plantId: plant._id, timestamp: { $gte: new Date(Date.now() - days * 24 * 3600 * 1000) } })
          .sort({ timestamp: 1 })
          .lean(),
        WeatherSnapshot.findOne({ plantId: plant._id, observed: true }).sort({ generatedAt: -1 }).lean(),
      ]);

      if (!hourly.length) {
        logger.warn(`[BackfillWeather] ${plant.name}: no observed weather returned — skipped`);
        continue;
      }

      // What the fit becomes with this weather in hand — the whole point of the run.
      const fit = calibrate(plant, telemetry, hourly);

      logger.info(
        `[BackfillWeather] ${plant.name}: ${hourly.length} observed hours, ` +
        `${telemetry.length} readings → factor ${fit.factor} from ${fit.samples} paired hours ` +
        `(band ±${(fit.bandPct * 100).toFixed(1)}%, calibrated=${fit.calibrated})`
      );

      if (!apply) continue;

      // One document per plant, replaced on each run rather than accumulating.
      if (existing) await WeatherSnapshot.deleteMany({ plantId: plant._id, observed: true });
      await WeatherSnapshot.create({
        plantId: plant._id,
        source: SOURCE,
        hourly,
        observed: true,
        generatedAt: new Date(),
      });
    }

    logger.info(
      apply
        ? '[BackfillWeather] Done — the next forecast run will calibrate against this.'
        : '[BackfillWeather] Nothing written. Re-run with --apply to store it.'
    );
  } catch (err) {
    logger.error('[BackfillWeather] Failed:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) backfillObservedWeather();

module.exports = { backfillObservedWeather, SOURCE };
