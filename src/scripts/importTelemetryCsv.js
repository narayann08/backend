'use strict';
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { connectDB } = require('../config/db');
const logger = require('../utils/logger');
const Plant = require('../models/Plant');
const Telemetry = require('../models/Telemetry');

/**
 * Imports the mock SCADA telemetry CSV (tests/fixtures/mock_telemetry.csv by default)
 * into a real MongoDB instance, so the actual API/AI pipeline can be exercised end to
 * end against it (e.g. `POST /v1/plants/:id/forecast`) rather than through mocks.
 *
 * Usage: node src/scripts/importTelemetryCsv.js [csvPath]
 */

function parseCsv(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8').trim();
  const [headerLine, ...lines] = raw.split('\n');
  const headers = headerLine.split(',');
  return lines.filter(Boolean).map(line => {
    const cells = line.split(',');
    const row = {};
    headers.forEach((h, i) => { row[h] = cells[i]; });
    return row;
  });
}

function groupByPlant(rows) {
  const byPlant = new Map();
  for (const row of rows) {
    if (!byPlant.has(row.plantId)) {
      byPlant.set(row.plantId, {
        name: row.plantName,
        type: row.plantType,
        capacityMW: Number(row.capacityMW),
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        hasLimitedHistory: false,
        telemetry: [],
      });
    }
    byPlant.get(row.plantId).telemetry.push({
      timestamp: new Date(row.timestamp),
      generationMW: Number(row.generationMW),
      sensorStatus: row.sensorStatus,
      outage: row.outage === 'true',
    });
  }
  return byPlant;
}

async function importTelemetryCsv(csvPath) {
  logger.info(`Importing mock telemetry from ${csvPath}`);
  const rows = parseCsv(csvPath);
  const byPlant = groupByPlant(rows);

  await connectDB();
  logger.info('Connected to database.');

  for (const [csvPlantId, data] of byPlant) {
    let plant = await Plant.findOne({ name: data.name });
    if (!plant) {
      plant = await Plant.create({
        name: data.name,
        type: data.type,
        latitude: data.latitude,
        longitude: data.longitude,
        capacityMW: data.capacityMW,
        hasLimitedHistory: data.hasLimitedHistory,
      });
      logger.info(`Created plant "${plant.name}" -> ${plant._id} (CSV id ${csvPlantId})`);
    } else {
      logger.info(`Plant "${plant.name}" already exists -> ${plant._id}`);
    }

    const existingCount = await Telemetry.countDocuments({ plantId: plant._id });
    if (existingCount >= data.telemetry.length) {
      logger.info(`Telemetry already imported for ${plant.name} (${existingCount} points) — skipping`);
      continue;
    }

    const batch = data.telemetry.map(t => ({ plantId: plant._id, ...t }));
    await Telemetry.insertMany(batch);
    logger.info(`Inserted ${batch.length} telemetry points for ${plant.name} (${plant._id})`);
  }

  logger.info('CSV import complete. Trigger a forecast with: POST /v1/plants/:plantId/forecast');
}

async function main() {
  const csvPath = process.argv[2]
    || path.join(__dirname, '..', '..', 'tests', 'fixtures', 'mock_telemetry.csv');
  try {
    await importTelemetryCsv(csvPath);
  } catch (err) {
    logger.error('CSV import failed:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main();
}

module.exports = { importTelemetryCsv, parseCsv, groupByPlant };
