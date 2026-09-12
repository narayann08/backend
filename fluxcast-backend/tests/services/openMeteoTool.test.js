'use strict';
const { fetchOpenMeteoWeather } = require('../../src/services/connectors/openMeteoConnector');
jest.mock('../../src/services/connectors/openMeteoConnector');

const openMeteoTool = require('../../src/services/mcp-tools/openMeteoTool');

describe('MCP Tool: openMeteoTool', () => {
  beforeEach(() => jest.clearAllMocks());

  it('has valid MCP metadata and required properties', () => {
    expect(openMeteoTool.name).toBe('openMeteoTool');
    expect(openMeteoTool.inputSchema.required).toEqual(['latitude', 'longitude']);
  });

  it('delegates to fetchOpenMeteoWeather and returns wrapped source object', async () => {
    const mockHourly = [{ time: new Date(), ghiWm2: 500, temperatureC: 25 }];
    fetchOpenMeteoWeather.mockResolvedValue(mockHourly);

    const result = await openMeteoTool.handler({
      latitude: 27.53,
      longitude: 71.91,
      hours: 24,
      plantType: 'solar',
    });

    expect(fetchOpenMeteoWeather).toHaveBeenCalledWith(27.53, 71.91, 24, 'solar');
    expect(result).toEqual({
      source: 'open-meteo',
      hourly: mockHourly,
    });
  });

  it('applies default hours (72) and plantType (solar) if omitted', async () => {
    fetchOpenMeteoWeather.mockResolvedValue([]);

    await openMeteoTool.handler({ latitude: 12.34, longitude: 56.78 });

    expect(fetchOpenMeteoWeather).toHaveBeenCalledWith(12.34, 56.78, 72, 'solar');
  });
});
