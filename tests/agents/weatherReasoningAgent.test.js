'use strict';
const openMeteoTool = require('../../src/services/mcp-tools/openMeteoTool');
const nasaPowerTool = require('../../src/services/mcp-tools/nasaPowerTool');
const WeatherSnapshot = require('../../src/models/WeatherSnapshot');
const { completeJson } = require('../../src/services/llm/xaiClient');

jest.mock('../../src/services/mcp-tools/openMeteoTool');
jest.mock('../../src/services/mcp-tools/nasaPowerTool');
jest.mock('../../src/models/WeatherSnapshot');
jest.mock('../../src/services/llm/xaiClient');

const { runWeatherReasoningAgent } = require('../../src/services/agents/weatherReasoningAgent');

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

  const sampleHourly = [
    {
      time: '2026-09-12T00:00:00.000Z',
      cloudCoverPct: 10,
      ghiWm2: 0,
      temperatureC: 22,
    },
    {
      time: '2026-09-12T06:00:00.000Z',
      cloudCoverPct: 15,
      ghiWm2: 350,
      temperatureC: 28,
    },
  ];

  it('queries openMeteo and nasaPower tools and uses LLM to reconcile data', async () => {
    openMeteoTool.handler.mockResolvedValue({
      source: 'open-meteo',
      hourly: sampleHourly,
    });
    nasaPowerTool.handler.mockResolvedValue({
      source: 'nasa-power',
      hourly: sampleHourly,
      available: true,
    });

    completeJson.mockResolvedValue(sampleHourly);

    WeatherSnapshot.create.mockResolvedValue({
      _id: 'snapshot-1',
      plantId: mockPlant._id,
      source: 'open-meteo+nasa-power (reconciled)',
      hourly: sampleHourly,
      toObject: () => ({
        _id: 'snapshot-1',
        plantId: mockPlant._id,
        source: 'open-meteo+nasa-power (reconciled)',
        hourly: sampleHourly,
      }),
    });

    const result = await runWeatherReasoningAgent(mockPlant, 24);

    expect(openMeteoTool.handler).toHaveBeenCalledWith(
      expect.objectContaining({ latitude: 27.53, longitude: 71.91, hours: 24, plantType: 'solar' })
    );
    expect(nasaPowerTool.handler).toHaveBeenCalledWith(
      expect.objectContaining({ latitude: 27.53, longitude: 71.91, hours: 24, plantType: 'solar' })
    );
    expect(completeJson).toHaveBeenCalled();
    expect(WeatherSnapshot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        plantId: mockPlant._id,
        source: 'open-meteo+nasa-power (reconciled)',
        hourly: sampleHourly,
      })
    );
    expect(result.hourly.length).toBe(2);
  });

  it('falls back to Open-Meteo data when LLM fails or times out', async () => {
    openMeteoTool.handler.mockResolvedValue({
      source: 'open-meteo',
      hourly: sampleHourly,
    });
    nasaPowerTool.handler.mockResolvedValue({ available: false, hourly: null });

    completeJson.mockRejectedValue(new Error('LLM Rate Limit'));

    WeatherSnapshot.create.mockResolvedValue({
      _id: 'snapshot-fallback',
      plantId: mockPlant._id,
      source: 'open-meteo (reconciled)',
      hourly: sampleHourly,
      toObject: () => ({
        _id: 'snapshot-fallback',
        plantId: mockPlant._id,
        source: 'open-meteo (reconciled)',
        hourly: sampleHourly,
      }),
    });

    const result = await runWeatherReasoningAgent(mockPlant, 24);

    expect(result.hourly).toEqual(sampleHourly);
    expect(WeatherSnapshot.create).toHaveBeenCalled();
  });
});
