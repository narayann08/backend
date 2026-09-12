'use strict';

/**
 * MCP Tool: demandDataTool
 *
 * Read current or forecast electricity demand relevant to a plant/grid region.
 * Currently stubbed with a sinusoidal pattern — replace with a real grid-demand
 * API or MongoDB collection when available.
 */
const demandDataTool = {
  name: 'demandDataTool',
  description:
    'Read current or forecast electricity demand relevant to a plant/grid region. ' +
    'Use this to understand demand context before recommending grid actions like ' +
    'export, curtailment, or backup activation.',
  inputSchema: {
    type: 'object',
    required: ['plantId'],
    properties: {
      plantId: { type: 'string' },
      hours:   { type: 'number', default: 24 },
    },
  },
  /**
   * @param {{ plantId: string, hours?: number }} input
   */
  async handler(input) {
    // Stub: sinusoidal demand pattern (base 150 MW, ±30 MW variation)
    const hours  = input.hours || 24;
    const hourly = [];
    const base   = 150;

    for (let i = 0; i < hours; i++) {
      hourly.push({
        time:     new Date(Date.now() + i * 3600 * 1000),
        demandMW: base + Math.sin((i / 6) * Math.PI) * 30,
      });
    }

    return {
      plantId: input.plantId,
      hourly,
      note: 'Stub demand data — integrate with real grid API or DB collection for production',
    };
  },
};

module.exports = demandDataTool;
