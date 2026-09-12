'use strict';
const Telemetry = require('../../models/Telemetry');

/**
 * Read a plant's recent telemetry from MongoDB.
 * Direct DB read — no external API call.
 *
 * @param {string} plantId
 * @param {number} days
 * @returns {Promise<Array<object>>}
 */
async function getRecentTelemetry(plantId, days = 4) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return Telemetry
    .find({ plantId, timestamp: { $gte: since } })
    .sort({ timestamp: 1 })
    .lean();
}

module.exports = { getRecentTelemetry };
