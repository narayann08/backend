'use strict';
const { fetchNasaWeather } = require('../../src/services/connectors/nasaConnector');
jest.mock('../../src/services/connectors/nasaConnector');

const nasaPowerTool = require('../../src/services/mcp-tools/nasaPowerTool');
const nasaGisTool = require('../../src/services/mcp-tools/nasaGisTool');

describe('MCP Tool: nasaPowerTool', () => {
  beforeEach(() => jest.clearAllMocks());

  it('has valid MCP metadata and name', () => {
    expect(nasaPowerTool.name).toBe('nasaPowerTool');
    expect(nasaGisTool.name).toBe('nasaGisTool');
    expect(nasaPowerTool.inputSchema.required).toEqual(['latitude', 'longitude']);
  });

  it('delegates to fetchNasaWeather and marks available true when records are returned', async () => {
    const mockHourly = [{ time: new Date(), ghiWm2: 650, temperatureC: 30 }];
    fetchNasaWeather.mockResolvedValue(mockHourly);

    const result = await nasaPowerTool.handler({
      latitude: 27.53,
      longitude: 71.91,
      hours: 24,
      plantType: 'solar',
    });

    expect(fetchNasaWeather).toHaveBeenCalledWith(27.53, 71.91, 24, 'solar');
    expect(result).toEqual({
      source: 'nasa-power',
      hourly: mockHourly,
      available: true,
    });
  });

  it('marks available false when fetchNasaWeather returns null or empty', async () => {
    fetchNasaWeather.mockResolvedValue(null);

    const result = await nasaPowerTool.handler({
      latitude: 27.53,
      longitude: 71.91,
    });

    expect(result).toEqual({
      source: 'nasa-power',
      hourly: null,
      available: false,
    });
  });
});
