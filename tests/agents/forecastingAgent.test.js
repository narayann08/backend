'use strict';
const telemetryTool = require('../../src/services/mcp-tools/telemetryTool');
const ragRetrieverTool = require('../../src/services/mcp-tools/ragRetrieverTool');
const ForecastResult = require('../../src/models/ForecastResult');
const { completeJson } = require('../../src/services/llm/xaiClient');

jest.mock('../../src/services/mcp-tools/telemetryTool');
jest.mock('../../src/services/mcp-tools/ragRetrieverTool');
jest.mock('../../src/models/ForecastResult');
jest.mock('../../src/services/llm/xaiClient');

const { runForecastingAgent } = require('../../src/services/agents/forecastingAgent');

describe('Agent: forecastingAgent', () => {
  beforeEach(() => jest.clearAllMocks());

  const mockPlantStandard = {
    _id: '507f1f77bcf86cd799439011',
    name: 'Bhadla Solar 1',
    type: 'solar',
    capacityMW: 500,
    hasLimitedHistory: false,
  };

  const mockPlantNew = {
    _id: '507f1f77bcf86cd799439012',
    name: 'New Solar Unit',
    type: 'solar',
    capacityMW: 100,
    hasLimitedHistory: true, // Triggers RAG
  };

  const mockWeatherSnapshot = {
    hourly: [
      { time: '2026-09-12T00:00:00Z', ghiWm2: 0, cloudCoverPct: 0, windSpeedMs: 3, temperatureC: 25 },
      { time: '2026-09-12T01:00:00Z', ghiWm2: 200, cloudCoverPct: 10, windSpeedMs: 4, temperatureC: 27 },
    ],
  };

  it('generates forecast points and risk windows for a standard plant', async () => {
    telemetryTool.handler.mockResolvedValue([
      { timestamp: new Date(), actualGenerationMW: 320, sensorStatus: 'normal' },
    ]);

    const mockForecastData = {
      points: [
        {
          time: '2026-09-12T00:00:00Z',
          expectedMW: 150,
          lowerBoundMW: 120,
          upperBoundMW: 180,
          confidencePct: 80,
        },
      ],
      riskWindows: [{ start: '2026-09-12T12:00:00Z', end: '2026-09-12T15:00:00Z', type: 'over_generation' }],
    };

    completeJson.mockResolvedValue(mockForecastData);

    ForecastResult.create.mockResolvedValue({
      _id: 'forecast-doc-1',
      points: mockForecastData.points,
      riskWindows: mockForecastData.riskWindows,
      toObject: () => ({
        _id: 'forecast-doc-1',
        points: mockForecastData.points,
        riskWindows: mockForecastData.riskWindows,
      }),
    });

    const state = {
      plant: mockPlantStandard,
      weatherSnapshot: mockWeatherSnapshot,
      horizon: 24,
      jobId: 'job-1',
    };

    const nextState = await runForecastingAgent(state);

    expect(telemetryTool.handler).toHaveBeenCalledWith({ plantId: mockPlantStandard._id.toString(), days: 4 });
    expect(ragRetrieverTool.handler).not.toHaveBeenCalled(); // not called because hasLimitedHistory is false
    expect(ForecastResult.create).toHaveBeenCalled();
    expect(nextState.forecast).toBeDefined();
    expect(nextState.forecast.points.length).toBe(1);
  });

  it('triggers RAG similarity search when plant.hasLimitedHistory is true', async () => {
    telemetryTool.handler.mockResolvedValue([]);
    ragRetrieverTool.handler.mockResolvedValue({ results: [{ score: 0.92, generationMW: 80 }] });

    completeJson.mockResolvedValue({ points: [{ expectedMW: 60 }], riskWindows: [] });

    ForecastResult.create.mockResolvedValue({
      _id: 'forecast-rag',
      toObject: () => ({ _id: 'forecast-rag', points: [{ expectedMW: 60 }] }),
    });

    const state = {
      plant: mockPlantNew,
      weatherSnapshot: mockWeatherSnapshot,
      horizon: 24,
    };

    await runForecastingAgent(state);

    expect(ragRetrieverTool.handler).toHaveBeenCalledWith(
      expect.objectContaining({ plantType: 'solar', topK: 3 })
    );
  });

  it('falls back to flat 50% capacity curve when LLM call errors', async () => {
    telemetryTool.handler.mockResolvedValue([]);
    completeJson.mockRejectedValue(new Error('Grok API Timeout'));

    ForecastResult.create.mockImplementation(args => Promise.resolve({
      ...args,
      _id: 'fallback-forecast',
      toObject: () => ({ ...args, _id: 'fallback-forecast' }),
    }));

    const state = {
      plant: mockPlantStandard,
      weatherSnapshot: mockWeatherSnapshot,
      horizon: 24,
    };

    const nextState = await runForecastingAgent(state);

    expect(nextState.forecast.points.length).toBe(24);
    expect(nextState.forecast.points[0].expectedMW).toBe(mockPlantStandard.capacityMW * 0.5);
  });
});
