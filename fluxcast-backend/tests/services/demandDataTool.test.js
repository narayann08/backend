'use strict';
const demandDataTool = require('../../src/services/mcp-tools/demandDataTool');

describe('MCP Tool: demandDataTool', () => {
  it('has valid MCP tool metadata and schema', () => {
    expect(demandDataTool.name).toBe('demandDataTool');
    expect(typeof demandDataTool.description).toBe('string');
    expect(demandDataTool.inputSchema.required).toContain('plantId');
  });

  it('returns default 24 hours of demand data when hours is omitted', async () => {
    const result = await demandDataTool.handler({ plantId: 'plant-456' });

    expect(result).toBeDefined();
    expect(result.plantId).toBe('plant-456');
    expect(Array.isArray(result.hourly)).toBe(true);
    expect(result.hourly.length).toBe(24);

    const first = result.hourly[0];
    expect(first.time instanceof Date).toBe(true);
    expect(typeof first.demandMW).toBe('number');
    expect(first.demandMW).toBeGreaterThan(0);
  });

  it('returns custom horizon of demand data when hours is specified', async () => {
    const result = await demandDataTool.handler({ plantId: 'plant-456', hours: 48 });

    expect(result.hourly.length).toBe(48);
  });
});
