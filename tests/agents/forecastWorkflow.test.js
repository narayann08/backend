'use strict';
const { runWeatherReasoningAgent } = require('../../src/services/agents/weatherReasoningAgent');
const { runForecastingAgent }      = require('../../src/services/agents/forecastingAgent');
const { runDecisionAgent }         = require('../../src/services/agents/decisionAgent');
const { runExplainabilityAgent }   = require('../../src/services/agents/explainabilityAgent');

jest.mock('../../src/services/agents/weatherReasoningAgent');
jest.mock('../../src/services/agents/forecastingAgent');
jest.mock('../../src/services/agents/decisionAgent');
jest.mock('../../src/services/agents/explainabilityAgent');

const { runForecastWorkflow } = require('../../src/services/graph/forecastWorkflow');

describe('Workflow: runForecastWorkflow', () => {
  beforeEach(() => jest.clearAllMocks());

  const mockPlant = {
    _id: '507f1f77bcf86cd799439011',
    name: 'Bhadla Solar Park',
    type: 'solar',
    capacityMW: 500,
  };

  it('orchestrates all 4 agent nodes in sequence and passes updated state', async () => {
    const mockWeather = { hourly: [{ ghiWm2: 500 }] };
    const mockForecast = { points: [{ expectedMW: 300 }], riskWindows: [] };
    const mockRec = { action: 'hold', amountMW: 0 };

    runWeatherReasoningAgent.mockResolvedValue(mockWeather);
    runForecastingAgent.mockImplementation(state => Promise.resolve({ ...state, forecast: mockForecast }));
    runDecisionAgent.mockImplementation(state => Promise.resolve({ ...state, recommendation: mockRec }));
    runExplainabilityAgent.mockImplementation(state => Promise.resolve({
      ...state,
      explanation: 'Conditions are stable.',
      explanationFactors: ['solar_ghi'],
    }));

    const result = await runForecastWorkflow({
      plant: mockPlant,
      horizon: 24,
      jobId: 'job-workflow-1',
      simulationMode: false,
    });

    expect(runWeatherReasoningAgent).toHaveBeenCalledWith(mockPlant, 24);
    expect(runForecastingAgent).toHaveBeenCalledWith(
      expect.objectContaining({ weatherSnapshot: mockWeather, horizon: 24 })
    );
    expect(runDecisionAgent).toHaveBeenCalledWith(
      expect.objectContaining({ forecast: mockForecast })
    );
    expect(runExplainabilityAgent).toHaveBeenCalledWith(
      expect.objectContaining({ recommendation: mockRec })
    );

    expect(result).toEqual({
      forecast: mockForecast,
      recommendation: mockRec,
      explanation: 'Conditions are stable.',
      explanationFactors: ['solar_ghi'],
    });
  });
});
