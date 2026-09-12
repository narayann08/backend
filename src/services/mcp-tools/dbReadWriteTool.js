'use strict';
const ForecastResult  = require('../../models/ForecastResult');
const Recommendation  = require('../../models/Recommendation');
const Alert           = require('../../models/Alert');
const WeatherSnapshot = require('../../models/WeatherSnapshot');

const MODELS = {
  forecasts:        ForecastResult,
  recommendations:  Recommendation,
  alerts:           Alert,
  weatherSnapshots: WeatherSnapshot,
};

/**
 * MCP Tool: dbReadWriteTool
 *
 * Save or retrieve forecasts, recommendations, alerts, and weather snapshots
 * to/from the database. Used by multiple agents to persist their output.
 */
const dbReadWriteTool = {
  name: 'dbReadWriteTool',
  description:
    'Save or retrieve forecasts, recommendations, alerts, and weather snapshots to/from the database. ' +
    'Use write at the end of each agent step to persist results. ' +
    'Use read to retrieve the latest saved data for a plant.',
  inputSchema: {
    type: 'object',
    required: ['operation', 'collection'],
    properties: {
      operation:  { type: 'string', enum: ['read', 'write'] },
      collection: { type: 'string', enum: ['forecasts', 'recommendations', 'alerts', 'weatherSnapshots'] },
      plantId:    { type: 'string' },
      data:       { type: 'object', description: 'Data to write (required for write operations)' },
    },
  },
  /**
   * @param {{ operation: string, collection: string, plantId?: string, data?: object }} input
   */
  async handler(input) {
    const { operation, collection, plantId, data } = input;
    const Model = MODELS[collection];
    if (!Model) throw new Error(`Unknown collection: ${collection}`);

    if (operation === 'write') {
      const doc = await Model.create(data);
      return { success: true, id: doc._id };
    } else {
      const doc = await Model.findOne({ plantId }).sort({ createdAt: -1 }).lean();
      return doc || null;
    }
  },
};

module.exports = dbReadWriteTool;
