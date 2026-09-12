'use strict';
const fs = require('fs');
const path = require('path');

/**
 * Generates a deterministic mock SCADA telemetry CSV for pipeline testing.
 *
 * Produces 96 hourly rows (4 days) each for one solar and one wind plant,
 * using the same physics curves as src/scripts/seed.js (no randomness, so
 * the file is reproducible and safe to use as an assertable fixture).
 * A short run of `sensorStatus=degraded` / `outage=true` rows is injected
 * near the end of each plant's series so the ForecastingAgent's
 * `operational_risk` detection (which inspects the most recent readings)
 * has something real to flag.
 *
 * Usage: node src/scripts/generateMockTelemetryCsv.js [outputPath]
 */

const PLANTS = [
  {
    plantId: '64fae1a1a1a1a1a1a1a1a101',
    plantName: 'Mock Solar Test Farm',
    plantType: 'solar',
    capacityMW: 100,
    latitude: 23.9,
    longitude: 71.2,
  },
  {
    plantId: '64fae1a1a1a1a1a1a1a1a102',
    plantName: 'Mock Wind Test Farm',
    plantType: 'wind',
    capacityMW: 80,
    latitude: 8.25,
    longitude: 77.54,
  },
];

const HOURS = 96;
const ANCHOR = Date.UTC(2026, 8, 8, 0, 0, 0); // 2026-09-08T00:00:00Z

// Indices (0-based, ascending in time) within the last 10 readings that
// carry a sensor anomaly, so telemetry.slice(-10) in forecastingAgent sees it.
// Chosen to land during solar daylight hours so the anomaly is visible
// against a non-zero baseline (not just masked by nighttime zero output).
const DEGRADED_INDEX = 86; // hour 14 UTC — sensor flaky, under-reports actual output
const OUTAGE_INDEX = 88;   // hour 16 UTC — full outage: generation forced to zero

function solarGenerationMW(capacityMW, hourOfDay) {
  if (hourOfDay < 6 || hourOfDay > 18) return 0;
  const peakFactor = Math.sin(((hourOfDay - 6) / 12) * Math.PI);
  return Math.max(0, capacityMW * 0.85 * peakFactor);
}

function windGenerationMW(capacityMW, hourOfDay) {
  const windFactor = 0.4 + 0.3 * Math.cos((hourOfDay / 24) * 2 * Math.PI);
  return Math.max(0, Math.min(capacityMW, capacityMW * windFactor));
}

function buildRows() {
  const rows = [];
  for (const plant of PLANTS) {
    for (let i = 0; i < HOURS; i++) {
      const timestamp = new Date(ANCHOR + i * 3600 * 1000);
      const hourOfDay = timestamp.getUTCHours();

      let generationMW = plant.plantType === 'solar'
        ? solarGenerationMW(plant.capacityMW, hourOfDay)
        : windGenerationMW(plant.capacityMW, hourOfDay);

      let sensorStatus = 'ok';
      let outage = false;

      if (i === DEGRADED_INDEX) {
        sensorStatus = 'degraded';
        generationMW *= 0.6; // degraded sensor under-reports actual output
      } else if (i === OUTAGE_INDEX) {
        sensorStatus = 'offline';
        outage = true;
        generationMW = 0;
      }

      rows.push({
        plantId: plant.plantId,
        plantName: plant.plantName,
        plantType: plant.plantType,
        capacityMW: plant.capacityMW,
        latitude: plant.latitude,
        longitude: plant.longitude,
        timestamp: timestamp.toISOString(),
        generationMW: Math.round(generationMW * 100) / 100,
        sensorStatus,
        outage,
      });
    }
  }
  return rows;
}

function toCsv(rows) {
  const header = [
    'plantId', 'plantName', 'plantType', 'capacityMW', 'latitude', 'longitude',
    'timestamp', 'generationMW', 'sensorStatus', 'outage',
  ];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push(header.map(h => r[h]).join(','));
  }
  return lines.join('\n') + '\n';
}

function main() {
  const outputPath = process.argv[2]
    || path.join(__dirname, '..', '..', 'tests', 'fixtures', 'mock_telemetry.csv');
  const rows = buildRows();
  fs.writeFileSync(outputPath, toCsv(rows));
  console.log(`Wrote ${rows.length} mock telemetry rows to ${outputPath}`);
}

if (require.main === module) {
  main();
}

module.exports = { buildRows, toCsv, PLANTS, HOURS, DEGRADED_INDEX, OUTAGE_INDEX };
