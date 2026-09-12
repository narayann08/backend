'use strict';
const batteryStatusTool = require('../../src/services/mcp-tools/batteryStatusTool');

describe('MCP Tool: batteryStatusTool', () => {
  it('has valid MCP tool metadata and schema', () => {
    expect(batteryStatusTool.name).toBe('batteryStatusTool');
    expect(typeof batteryStatusTool.description).toBe('string');
    expect(batteryStatusTool.inputSchema).toBeDefined();
    expect(batteryStatusTool.inputSchema.required).toContain('plantId');
  });

  it('returns valid battery charge and capacity status for a plant', async () => {
    const result = await batteryStatusTool.handler({ plantId: 'plant-123' });

    expect(result).toBeDefined();
    expect(result.plantId).toBe('plant-123');
    expect(typeof result.chargePercent).toBe('number');
    expect(result.chargePercent).toBeGreaterThanOrEqual(0);
    expect(result.chargePercent).toBeLessThanOrEqual(100);
    expect(result.availableCapacityMWh).toBeGreaterThanOrEqual(0);
    expect(result.maxCapacityMWh).toBeGreaterThan(0);
    expect(result.status).toBe('ok');
  });
});
