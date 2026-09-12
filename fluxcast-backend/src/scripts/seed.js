'use strict';
require('dotenv').config();
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const { istHourOfDay } = require('../utils/istTime');
const { connectDB } = require('../config/db');
const User = require('../models/User');
const Plant = require('../models/Plant');
const Telemetry = require('../models/Telemetry');
const WeatherSnapshot = require('../models/WeatherSnapshot');
const ForecastResult = require('../models/ForecastResult');
const Recommendation = require('../models/Recommendation');
const Alert = require('../models/Alert');
const Notification = require('../models/Notification');
const { runForecastWorkflow } = require('../services/graph/forecastWorkflow');

/**
 * Seed database with a realistic Indian renewable-energy fleet for development
 * and demos.
 *
 * This is a genuine reseed, not an additive one: any plant already in the
 * database whose name is not in PLANTS below (i.e. the old 3-plant demo set)
 * is removed along with everything scoped to it — telemetry, weather
 * snapshots, forecasts, recommendations, alerts, notifications — so the
 * database never carries orphaned data pointing at a deleted plant. Plants
 * that match by name are updated in place (so field tweaks here always win on
 * a re-run) and get fresh telemetry regenerated from scratch.
 *
 * Coordinates and capacities approximate real Indian solar/wind sites (see
 * per-plant comments); they are illustrative for a single project phase or
 * block at each site, not the full park's total capacity.
 */

// ── Users: unchanged by a reseed — role-based login depends on these existing ──
const USERS = [
  { name: 'System Admin', email: 'admin@fluxcast.io', password: 'Password123!', role: 'admin' },
  { name: 'Lead Grid Operator', email: 'operator@fluxcast.io', password: 'Password123!', role: 'grid_operator' },
  { name: 'Utility Administrator', email: 'utility@fluxcast.io', password: 'Password123!', role: 'utility_admin' },
];

// ── Plants: real Indian renewable-energy hubs across 6 states ─────────────────
const PLANTS = [
  {
    name: 'Bhadla Solar Park - Block IV',
    type: 'solar',
    latitude: 27.535,
    longitude: 71.915,
    capacityMW: 300,
    commissionedDate: new Date('2019-03-15'),
    solarSpec: { panelTiltDeg: 28, panelAzimuthDeg: 180 },
    hasLimitedHistory: false,
  },
  {
    name: 'Pavagada Solar Park - Phase II',
    type: 'solar',
    latitude: 14.098,
    longitude: 77.278,
    capacityMW: 250,
    commissionedDate: new Date('2019-08-01'),
    solarSpec: { panelTiltDeg: 14, panelAzimuthDeg: 180 },
    hasLimitedHistory: false,
  },
  {
    name: 'Kurnool Ultra Mega Solar Park',
    type: 'solar',
    latitude: 15.845,
    longitude: 78.300,
    capacityMW: 200,
    commissionedDate: new Date('2017-11-01'),
    solarSpec: { panelTiltDeg: 16, panelAzimuthDeg: 180 },
    hasLimitedHistory: false,
  },
  {
    name: 'Rewa Ultra Mega Solar Park',
    type: 'solar',
    latitude: 24.533,
    longitude: 81.295,
    capacityMW: 250,
    commissionedDate: new Date('2018-12-01'),
    solarSpec: { panelTiltDeg: 24, panelAzimuthDeg: 180 },
    hasLimitedHistory: false,
  },
  {
    name: 'Charanka Solar Park - Phase III',
    type: 'solar',
    latitude: 23.905,
    longitude: 71.205,
    capacityMW: 150,
    commissionedDate: new Date('2026-06-10'),
    solarSpec: { panelTiltDeg: 23, panelAzimuthDeg: 180 },
    hasLimitedHistory: true, // newly commissioned — triggers RAG similarity search
  },
  {
    name: 'Muppandal Wind Farm - Cluster A',
    type: 'wind',
    latitude: 8.252,
    longitude: 77.539,
    capacityMW: 150,
    commissionedDate: new Date('1999-01-01'),
    windSpec: { hubHeightM: 65, rotorDiameterM: 82 }, // one of India's earliest major wind farms
    hasLimitedHistory: false,
  },
  {
    name: 'Jaisalmer Wind Park - Zone 3',
    type: 'wind',
    latitude: 26.912,
    longitude: 70.908,
    capacityMW: 200,
    commissionedDate: new Date('2012-06-01'),
    windSpec: { hubHeightM: 100, rotorDiameterM: 100 },
    hasLimitedHistory: false,
  },
  {
    name: 'Dhule Wind Farm - Brahmanvel',
    type: 'wind',
    latitude: 20.713,
    longitude: 74.401,
    capacityMW: 100,
    commissionedDate: new Date('2009-03-01'),
    windSpec: { hubHeightM: 78, rotorDiameterM: 82 },
    hasLimitedHistory: false,
  },
];

const TELEMETRY_HOURS = 96; // 4 days

/** Per-day weather variability so the 4-day window isn't an identical repeating curve. */
function dailyWeatherFactor(type) {
  return type === 'solar'
    ? 0.6 + Math.random() * 0.5   // cloudy day .. very clear day
    : 0.55 + Math.random() * 0.7; // calm day .. gusty day
}

function solarGenerationMW(capacityMW, hourOfDay, dayFactor) {
  if (hourOfDay < 6 || hourOfDay > 18) return 0;
  const peakFactor = Math.sin(((hourOfDay - 6) / 12) * Math.PI);
  return Math.max(0, capacityMW * 0.8 * peakFactor * dayFactor);
}

function windGenerationMW(capacityMW, hourOfDay, dayFactor) {
  const base = 0.35 + 0.25 * Math.cos((hourOfDay / 24) * 2 * Math.PI);
  return Math.max(0, Math.min(capacityMW, capacityMW * base * dayFactor));
}

/**
 * Build TELEMETRY_HOURS+1 realistic hourly readings ending now, with genuine
 * day-to-day weather variability and at least one sensor fault + one outage
 * placed in the most recent readings (where the forecasting agent's
 * operational_risk check looks) so the demo has something real to surface.
 */
function buildTelemetryBatch(plant, now) {
  const rows = [];
  const dayFactors = new Map(); // dayIndex -> weather quality for that day

  for (let i = TELEMETRY_HOURS; i >= 0; i--) {
    const timestamp = new Date(now - i * 3600 * 1000);
    const hourOfDay = istHourOfDay(timestamp); // every plant is in India — IST, not UTC
    const dayIndex = Math.floor((TELEMETRY_HOURS - i) / 24);
    if (!dayFactors.has(dayIndex)) dayFactors.set(dayIndex, dailyWeatherFactor(plant.type));
    const dayFactor = dayFactors.get(dayIndex);

    const generationMW =
      plant.type === 'solar'
        ? solarGenerationMW(plant.capacityMW, hourOfDay, dayFactor)
        : windGenerationMW(plant.capacityMW, hourOfDay, dayFactor);

    rows.push({
      plantId: plant._id,
      timestamp,
      generationMW: Math.round(generationMW * 10) / 10,
      sensorStatus: 'ok',
      outage: false,
    });
  }

  // Inject one degraded reading and one outage among the last 10 hours,
  // preferring hours with meaningful expected output so the anomaly is
  // visible rather than masked by an already-zero nighttime reading.
  const recent = rows.slice(-10);
  const meaningful = recent.filter((r) => r.generationMW > plant.capacityMW * 0.05);
  const pickTargets = (meaningful.length >= 2 ? meaningful : recent).slice(-4);

  if (pickTargets[0]) {
    pickTargets[0].sensorStatus = 'degraded';
    pickTargets[0].generationMW = Math.round(pickTargets[0].generationMW * (0.5 + Math.random() * 0.25) * 10) / 10;
  }
  const outageTarget = pickTargets.find((r) => r !== pickTargets[0]);
  if (outageTarget) {
    outageTarget.sensorStatus = 'offline';
    outageTarget.outage = true;
    outageTarget.generationMW = 0;
  }

  return rows;
}

async function seedDatabase() {
  try {
    logger.info('Connecting to MongoDB for seeding...');
    await connectDB();
    logger.info('Connected to database.');

    // ── 1. Users — upsert, never deleted by a reseed ─────────────────────────
    logger.info('Seeding users...');
    for (const userData of USERS) {
      const existing = await User.findOne({ email: userData.email });
      if (!existing) {
        await User.create(userData);
        logger.info(`  created user: ${userData.email}`);
      } else {
        logger.info(`  user already exists: ${userData.email}`);
      }
    }

    // ── 2. Remove any plant not in the new realistic set, cascading cleanup ──
    const targetNames = PLANTS.map((p) => p.name);
    const stalePlants = await Plant.find({ name: { $nin: targetNames } }).lean();

    if (stalePlants.length) {
      logger.info(`Removing ${stalePlants.length} stale plant(s) from a previous seed...`);
      const staleIds = stalePlants.map((p) => p._id);
      for (const p of stalePlants) logger.info(`  removing: ${p.name}`);

      const alertIds = (await Alert.find({ plantId: { $in: staleIds } }).select('_id').lean()).map((a) => a._id);
      await Promise.all([
        Telemetry.deleteMany({ plantId: { $in: staleIds } }),
        WeatherSnapshot.deleteMany({ plantId: { $in: staleIds } }),
        ForecastResult.deleteMany({ plantId: { $in: staleIds } }),
        Recommendation.deleteMany({ plantId: { $in: staleIds } }),
        Notification.deleteMany({ plantId: { $in: staleIds } }),
        Alert.deleteMany({ plantId: { $in: staleIds } }),
      ]);
      if (alertIds.length) await Notification.deleteMany({ alertId: { $in: alertIds } });
      await Plant.deleteMany({ _id: { $in: staleIds } });
    }

    // ── 3. Upsert the realistic Indian plant fleet ───────────────────────────
    logger.info('Seeding plants (India-based fleet)...');
    const seededPlants = [];
    for (const plantData of PLANTS) {
      const plant = await Plant.findOneAndUpdate(
        { name: plantData.name },
        { $set: plantData },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      );
      logger.info(`  ${plant.name} — ${plant.type}, ${plant.capacityMW} MW (${plant._id})`);
      seededPlants.push(plant);
    }

    // ── 4. Regenerate telemetry fresh for every seeded plant ────────────────
    logger.info('Regenerating telemetry (last 4 days, hourly)...');
    const now = Date.now();
    for (const plant of seededPlants) {
      await Telemetry.deleteMany({ plantId: plant._id });
      const batch = buildTelemetryBatch(plant, now);
      await Telemetry.insertMany(batch);
      logger.info(`  ${plant.name}: ${batch.length} readings`);
    }

    // ── 5. Run the real forecast/decision/explainability pipeline per plant ──
    // Best-effort: this calls the actual agents (weather + Grok), same code
    // path as the hourly cron. If the LLM is unreachable each agent falls
    // back to its own documented deterministic behaviour — nothing here
    // fabricates forecast or recommendation data.
    logger.info('Running the live forecast pipeline for each plant (best effort)...');
    for (const plant of seededPlants) {
      try {
        const result = await runForecastWorkflow({
          plant: plant.toObject(),
          horizon: 24,
          jobId: uuidv4(),
        });
        logger.info(
          `  ${plant.name}: forecast generated, recommendation=${result.recommendation?.action}`,
        );
      } catch (err) {
        logger.warn(`  ${plant.name}: forecast pipeline failed (${err.message}) — skipping`);
      }
    }

    logger.info('Database reseed completed successfully!');
    logger.info(`Fleet: ${seededPlants.length} plants across India — ${
      seededPlants.filter((p) => p.type === 'solar').length
    } solar, ${seededPlants.filter((p) => p.type === 'wind').length} wind.`);
  } catch (err) {
    logger.error('Database seeding failed:', err);
  } finally {
    await mongoose.disconnect();
    logger.info('Disconnected from database.');
    process.exit(0);
  }
}

module.exports = { PLANTS, buildTelemetryBatch };

// Only auto-run when executed directly (`node seed.js` / `npm run seed`), not
// when required by another script (e.g. a one-off telemetry regeneration).
if (require.main === module) {
  seedDatabase();
}
