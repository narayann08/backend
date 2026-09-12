'use strict';
const notificationTool = require('../../src/services/mcp-tools/notificationTool');
const { ChatOpenAI } = require('@langchain/openai');

jest.mock('../../src/services/mcp-tools/notificationTool');
jest.mock('@langchain/openai');

const { runExplainabilityAgent } = require('../../src/services/agents/explainabilityAgent');

describe('Agent: explainabilityAgent', () => {
  beforeEach(() => jest.clearAllMocks());

  const mockPlant = {
    _id: '507f1f77bcf86cd799439011',
    name: 'Bhadla Solar 1',
    type: 'solar',
    capacityMW: 500,
  };

  const mockForecast = {
    horizonHours: 24,
    points: [{ expectedMW: 350 }, { expectedMW: 400 }],
    riskWindows: [
      { type: 'under_generation', start: '2026-09-12T08:00:00Z', end: '2026-09-12T11:00:00Z' },
    ],
  };

  const mockRecommendation = {
    action: 'discharge_battery',
    reasoning: 'Peak load expected with solar drop.',
  };

  it('generates plain-language summary and triggers notificationTool for risk windows', async () => {
    notificationTool.handler.mockResolvedValue({ success: true, alertId: 'alert-123' });

    const mockExplanation = {
      summary: 'Expected solar shortfall during morning hours requires battery discharge support.',
      factors: ['low_irradiance', 'morning_peak_demand', 'battery_availability'],
    };

    const mockInvoke = jest.fn().mockResolvedValue({
      content: JSON.stringify(mockExplanation),
    });
    ChatOpenAI.mockImplementation(() => ({ invoke: mockInvoke }));

    const state = {
      plant: mockPlant,
      forecast: mockForecast,
      recommendation: mockRecommendation,
      simulationMode: false,
    };

    const nextState = await runExplainabilityAgent(state);

    expect(nextState.explanation).toBe(mockExplanation.summary);
    expect(nextState.explanationFactors).toEqual(mockExplanation.factors);
    expect(notificationTool.handler).toHaveBeenCalledWith(
      expect.objectContaining({
        plantId: mockPlant._id.toString(),
        type: 'shortfall_risk',
        severity: 'medium',
      })
    );
  });

  it('does NOT raise alerts in simulation mode', async () => {
    const mockExplanation = {
      summary: 'Simulation explanation.',
      factors: ['simulation_override'],
    };

    const mockInvoke = jest.fn().mockResolvedValue({
      content: JSON.stringify(mockExplanation),
    });
    ChatOpenAI.mockImplementation(() => ({ invoke: mockInvoke }));

    const state = {
      plant: mockPlant,
      forecast: mockForecast,
      recommendation: mockRecommendation,
      simulationMode: true,
    };

    await runExplainabilityAgent(state);

    expect(notificationTool.handler).not.toHaveBeenCalled();
  });

  it('falls back to default explanation structure when LLM fails', async () => {
    notificationTool.handler.mockResolvedValue({});
    const mockInvoke = jest.fn().mockRejectedValue(new Error('LLM error'));
    ChatOpenAI.mockImplementation(() => ({ invoke: mockInvoke }));

    const state = {
      plant: mockPlant,
      forecast: mockForecast,
      recommendation: mockRecommendation,
      simulationMode: false,
    };

    const nextState = await runExplainabilityAgent(state);

    expect(nextState.explanation).toContain('discharge_battery');
    expect(nextState.explanationFactors.length).toBeGreaterThan(0);
  });
});
