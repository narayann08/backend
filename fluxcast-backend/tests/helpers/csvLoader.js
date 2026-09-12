'use strict';
const fs = require('fs');

/**
 * Minimal CSV parser for the mock telemetry fixture (no quoted/escaped
 * commas in this dataset, so a plain split is sufficient and dependency-free).
 *
 * @param {string} filePath
 * @returns {Array<object>} array of row objects keyed by header column
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

/**
 * Loads the mock telemetry CSV and groups rows by plant, producing
 * ready-to-use plant metadata + telemetry arrays shaped like the
 * Plant/Telemetry Mongoose models.
 *
 * @param {string} filePath
 * @returns {Map<string, {plant: object, telemetry: Array<object>}>}
 */
function loadTelemetryFixture(filePath) {
  const rows = parseCsv(filePath);
  const byPlant = new Map();

  for (const row of rows) {
    if (!byPlant.has(row.plantId)) {
      byPlant.set(row.plantId, {
        plant: {
          _id: row.plantId,
          name: row.plantName,
          type: row.plantType,
          capacityMW: Number(row.capacityMW),
          latitude: Number(row.latitude),
          longitude: Number(row.longitude),
          hasLimitedHistory: false,
        },
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

module.exports = { parseCsv, loadTelemetryFixture };
