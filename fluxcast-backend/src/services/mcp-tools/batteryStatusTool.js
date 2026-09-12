'use strict';

/**
 * MCP Tool: batteryStatusTool
 *
 * Read current battery/storage charge level and available capacity for a plant.
 * Currently DB-backed mock — will be replaced with real BMS integration.
 * Use before recommending charge/discharge actions.
 */
const batteryStatusTool = {
  name: 'batteryStatusTool',
  description:
    'Read current battery/storage charge level and available capacity for a plant. ' +
    'Use before recommending charge/discharge actions to ensure the recommendation ' +
    'respects storage limits.',
  inputSchema: {
    type: 'object',
    required: ['plantId'],
    properties: {
      plantId: { type: 'string' },
    },
  },
  /**
   * @param {{ plantId: string }} input
   */
  async handler(input) {
    // Placeholder mock — in production, query a BMS API or battery_status collection
    return {
      plantId:              input.plantId,
      chargePercent:        65,         // mock: 65% charged
      availableCapacityMWh: 2.5,        // mock: 2.5 MWh available to discharge
      maxCapacityMWh:       5.0,
      status:               'ok',
      note:                 'Mock battery status — integrate with real BMS for production',
    };
  },
};

module.exports = batteryStatusTool;
