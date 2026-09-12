'use strict';
const { getRecentTelemetry } = require('../../src/services/connectors/telemetryConnector');
jest.mock('../../src/services/connectors/telemetryConnector');

const telemetryTool = require('../../src/services/mcp-tools/telemetryTool');

describe('MCP Tool: telemetryTool', () => {
  beforeEach(() => jest.clearAllMocks());

  it('has valid MCP metadata and required properties', () => {
    expect(telemetryTool.name).toBe('telemetryTool');
    expect(telemetryTool.inputSchema.required).toContain('plantId');
  });

  it('delegates to getRecentTelemetry with default 4 days', async () => {
    const mockTelemetry = [
      { timestamp: new Date(), actualGenerationMW: 120.5, sensorStatus: 'normal' },
    ];
    getRecentTelemetry.mockResolvedValue(mockTelemetry);

    const result = await telemetryTool.handler({ plantId: 'plant-001' });

    expect(getRecentTelemetry).toHaveBeenCalledWith('plant-001', 4);
    expect(result).toEqual(mockTelemetry);
  });

  it('delegates to getRecentTelemetry with custom day count', async () => {
    getRecentTelemetry.mockResolvedValue([]);

    await telemetryTool.handler({ plantId: 'plant-001', days: 7 });

    expect(getRecentTelemetry).toHaveBeenCalledWith('plant-001', 7);
  });
});
