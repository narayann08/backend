'use strict';
const openMeteoTool = require('../../src/services/mcp-tools/openMeteoTool');
const nasaPowerTool = require('../../src/services/mcp-tools/nasaPowerTool');
const WeatherSnapshot = require('../../src/models/WeatherSnapshot');

jest.mock('../../src/services/mcp-tools/openMeteoTool');
jest.mock('../../src/services/mcp-tools/nasaPowerTool');
jest.mock('../../src/models/WeatherSnapshot');

const {
  runWeatherReasoningAgent,
  reconcileHourly,
} = require('../../src/services/agents/weatherReasoningAgent');

describe('Agent: weatherReasoningAgent', () => {
  beforeEach(() => jest.clearAllMocks());

  const mockPlant = {
    _id: '507f1f77bcf86cd799439011',
    name: 'Bhadla Solar Park',
    type: 'solar',
    latitude: 27.53,
    longitude: 71.91,
    capacityMW: 500,
  };

  /** A full day of weather, as the connector actually returns it. */
  const fullDay = Array.from({ length: 24 }, (_, i) => ({
    time: new Date(Date.UTC(2026, 8, 12, i)).toISOString(),
    cloudCoverPct: 10 + i,
    ghiWm2: i >= 6 && i <= 18 ? 100 * (i - 5) : 0,
    dniWm2: 0,
    temperatureC: 22 + i * 0.2,
    windSpeedMs: 4,
  }));

  function captureSnapshot() {
    WeatherSnapshot.create.mockImplementation((doc) =>
      Promise.resolve({ ...doc, _id: 'snapshot-1', toObject: () => ({ ...doc, _id: 'snapshot-1' }) })
    );
  }

  it('stores every hour the connector returned, not just the ones a prompt could carry', async () => {
    openMeteoTool.handler.mockResolvedValue({ source: 'open-meteo', hourly: fullDay });
    nasaPowerTool.handler.mockResolvedValue({ available: false, hourly: null });
    captureSnapshot();

    const result = await runWeatherReasoningAgent(mockPlant, 24);

    expect(result.hourly).toHaveLength(24);
    expect(WeatherSnapshot.create).toHaveBeenCalledWith(
      expect.objectContaining({ plantId: mockPlant._id, source: 'open-meteo (reconciled)' })
    );
    expect(WeatherSnapshot.create.mock.calls[0][0].hourly).toHaveLength(24);
  });

  it('queries both sources and labels the blend', async () => {
    openMeteoTool.handler.mockResolvedValue({ source: 'open-meteo', hourly: fullDay });
    nasaPowerTool.handler.mockResolvedValue({ available: true, hourly: fullDay });
    captureSnapshot();

    const result = await runWeatherReasoningAgent(mockPlant, 24);

    expect(openMeteoTool.handler).toHaveBeenCalledWith(
      expect.objectContaining({ latitude: 27.53, longitude: 71.91, hours: 24, plantType: 'solar' })
    );
    expect(nasaPowerTool.handler).toHaveBeenCalledWith(
      expect.objectContaining({ latitude: 27.53, longitude: 71.91, hours: 24, plantType: 'solar' })
    );
    expect(result.source).toBe('open-meteo+nasa-power (reconciled)');
  });

  it('still produces a snapshot when NASA POWER is unavailable', async () => {
    openMeteoTool.handler.mockResolvedValue({ source: 'open-meteo', hourly: fullDay });
    nasaPowerTool.handler.mockRejectedValue(new Error('POWER archive offline'));
    captureSnapshot();

    const result = await runWeatherReasoningAgent(mockPlant, 24);

    expect(result.hourly).toHaveLength(24);
    expect(result.source).toBe('open-meteo (reconciled)');
  });

  it('throws rather than storing an empty snapshot when every source fails', async () => {
    openMeteoTool.handler.mockRejectedValue(new Error('network down'));
    nasaPowerTool.handler.mockRejectedValue(new Error('network down'));

    await expect(runWeatherReasoningAgent(mockPlant, 24)).rejects.toThrow('No weather data available');
    expect(WeatherSnapshot.create).not.toHaveBeenCalled();
  });

  describe('reconcileHourly', () => {
    it('blends irradiance 75/25 toward NASA POWER on matching hours', () => {
      const merged = reconcileHourly(
        [{ time: '2026-09-12T06:00:00.000Z', ghiWm2: 400, windSpeedMs: 4 }],
        [{ time: '2026-09-12T06:00:00.000Z', ghiWm2: 800, windSpeedMs: 8 }]
      );
      expect(merged[0].ghiWm2).toBeCloseTo(500, 1); // 400*0.75 + 800*0.25
      expect(merged[0].windSpeedMs).toBeCloseTo(5, 1);
    });

    it('keeps the Open-Meteo hour untouched when NASA has no match', () => {
      const hour = { time: '2026-09-12T06:00:00.000Z', ghiWm2: 400 };
      expect(reconcileHourly([hour], [])).toEqual([hour]);
    });

    it('falls back to whichever source has the value', () => {
      const merged = reconcileHourly(
        [{ time: '2026-09-12T06:00:00.000Z', ghiWm2: null }],
        [{ time: '2026-09-12T06:00:00.000Z', ghiWm2: 700 }]
      );
      expect(merged[0].ghiWm2).toBe(700);
    });
  });
});
