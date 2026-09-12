'use strict';
require('dotenv').config();
const mongoose = require('mongoose');
const env = require('../config/env');
const logger = require('../utils/logger');
const { connectDB } = require('../config/db');
const User = require('../models/User');
const Plant = require('../models/Plant');
const Telemetry = require('../models/Telemetry');
const Alert = require('../models/Alert');

/**
 * Seed database with initial sample data for development and testing.
 */
async function seedDatabase() {
  try {
    logger.info('Connecting to MongoDB for seeding...');
    await connectDB();
    logger.info('Connected to database.');

    // ── 1. Seed Users ────────────────────────────────────────────────────────
    logger.info('Seeding users...');
    const users = [
      {
        name: 'System Admin',
        email: 'admin@fluxcast.io',
        password: 'Password123!',
        role: 'admin',
      },
      {
        name: 'Lead Grid Operator',
        email: 'operator@fluxcast.io',
        password: 'Password123!',
        role: 'grid_operator',
      },
      {
        name: 'Utility Administrator',
        email: 'utility@fluxcast.io',
        password: 'Password123!',
        role: 'utility_admin',
      },
    ];

    for (const userData of users) {
      const existing = await User.findOne({ email: userData.email });
      if (!existing) {
        await User.create(userData);
        logger.info(`Created user: ${userData.email}`);
      } else {
        logger.info(`User already exists: ${userData.email}`);
      }
    }

    // ── 2. Seed Plants ───────────────────────────────────────────────────────
    logger.info('Seeding plants...');
    const samplePlants = [
      {
        name: 'Bhadla Solar Park - Block 1',
        type: 'solar',
        latitude: 27.53,
        longitude: 71.91,
        capacityMW: 500,
        commissionedDate: new Date('2020-03-01'),
        solarSpec: {
          panelTiltDeg: 28,
          panelAzimuthDeg: 180,
        },
        hasLimitedHistory: false,
      },
      {
        name: 'Muppandal Wind Farm - Phase A',
        type: 'wind',
        latitude: 8.25,
        longitude: 77.54,
        capacityMW: 200,
        commissionedDate: new Date('2018-06-15'),
        windSpec: {
          hubHeightM: 100,
          rotorDiameterM: 90,
        },
        hasLimitedHistory: false,
      },
      {
        name: 'Charanka Solar Park - New Unit',
        type: 'solar',
        latitude: 23.90,
        longitude: 71.20,
        capacityMW: 150,
        commissionedDate: new Date('2026-01-10'),
        solarSpec: {
          panelTiltDeg: 24,
          panelAzimuthDeg: 180,
        },
        hasLimitedHistory: true, // triggers RAG vector search
      },
    ];

    const createdPlants = [];
    for (const plantData of samplePlants) {
      let plant = await Plant.findOne({ name: plantData.name });
      if (!plant) {
        plant = await Plant.create(plantData);
        logger.info(`Created plant: ${plant.name} (${plant._id})`);
      } else {
        logger.info(`Plant already exists: ${plant.name} (${plant._id})`);
      }
      createdPlants.push(plant);
    }

    // ── 3. Seed Telemetry (Last 4 Days) ──────────────────────────────────────
    logger.info('Seeding recent telemetry...');
    const now = Date.now();
    const hours = 96; // 4 days * 24 hours

    for (const plant of createdPlants) {
      const existingTelemetry = await Telemetry.countDocuments({ plantId: plant._id });
      if (existingTelemetry >= hours) {
        logger.info(`Telemetry already exists for ${plant.name} (${existingTelemetry} points)`);
        continue;
      }

      const telemetryBatch = [];
      for (let i = hours; i >= 0; i--) {
        const timestamp = new Date(now - i * 3600 * 1000);
        const hourOfDay = timestamp.getUTCHours();

        let generationMW = 0;
        if (plant.type === 'solar') {
          // Daylight curve between 6:00 and 18:00 UTC
          if (hourOfDay >= 6 && hourOfDay <= 18) {
            const peakFactor = Math.sin(((hourOfDay - 6) / 12) * Math.PI);
            generationMW = Math.max(0, plant.capacityMW * 0.85 * peakFactor + (Math.random() * 10 - 5));
          }
        } else {
          // Wind generation with diurnal variation
          const windFactor = 0.4 + 0.3 * Math.cos((hourOfDay / 24) * 2 * Math.PI) + (Math.random() * 0.2 - 0.1);
          generationMW = Math.max(0, Math.min(plant.capacityMW, plant.capacityMW * windFactor));
        }

        telemetryBatch.push({
          plantId: plant._id,
          timestamp,
          generationMW: Math.round(generationMW * 10) / 10,
          sensorStatus: Math.random() < 0.03 ? 'degraded' : 'ok',
          outage: false,
        });
      }

      await Telemetry.insertMany(telemetryBatch);
      logger.info(`Seeded ${telemetryBatch.length} telemetry points for ${plant.name}`);
    }

    // ── 4. Seed Initial Sample Alert ─────────────────────────────────────────
    const alertCount = await Alert.countDocuments();
    if (alertCount === 0 && createdPlants.length > 0) {
      await Alert.create({
        plantId: createdPlants[0]._id,
        severity: 'medium',
        type: 'shortfall_risk',
        message: 'System initialisation: Monitored forecast indicates low afternoon solar generation window.',
        acknowledged: false,
      });
      logger.info('Created sample initial alert.');
    }

    logger.info('Database seeding completed successfully!');
  } catch (err) {
    logger.error('Database seeding failed:', err);
  } finally {
    await mongoose.disconnect();
    logger.info('Disconnected from database.');
    process.exit(0);
  }
}

seedDatabase();
