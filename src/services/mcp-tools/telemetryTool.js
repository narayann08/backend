'use strict';
const { getRecentTelemetry } = require('../connectors/telemetryConnector');

/**
 * MCP Tool: telemetryTool
 *
 * Read a plant's own recent actual generation output, sensor status,
 * and outage history for the last N days.
 * Use this to understand the plant's recent performance trend before generating a forecast.
 */
const telemetryTool = {
  name: 'telemetryTool',
  description:
    "Read a plant's own recent actual generation output, sensor status, and outage history " +
    "for the last N days. Use this to understand the plant's recent performance trend " +
    'before generating a forecast.',
  inputSchema: {
    type: 'object',
    required: ['plantId'],
    properties: {
      plantId: { type: 'string' },
      days:    { type: 'number', default: 4 },
    },
  },
  /**
   * @param {{ plantId: string, days?: number }} input
   */
  async handler(input) {
    const { plantId, days = 4 } = input;
    return getRecentTelemetry(plantId, days);
  },
};

module.exports = telemetryTool;
