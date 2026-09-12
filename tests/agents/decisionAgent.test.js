'use strict';
const batteryStatusTool = require('../../src/services/mcp-tools/batteryStatusTool');
const demandDataTool = require('../../src/services/mcp-tools/demandDataTool');
const Recommendation = require('../../src/models/Recommendation');
const { ChatOpenAI } = require('@langchain/openai');

jest.mock('../../src/services/mcp-tools/batteryStatusTool');
jest.mock('../../src/services/mcp-tools/demandDataTool');
jest.mock('../../src/models/Recommendation');
jest.mock('@langchain/openai');

const { runDecisionAgent } = require('../../src/services/agents/decisionAgent');

describe('Agent: decisionAgent', () => {
  beforeEach(() => jest.clearAllMocks());

  const mockPlant = {
    _id: '507f1f77bcf86cd799439011',
    name: 'Bhadla Solar 1',
    type: 'solar',
    capacityMW: 500,
  };

  const mockForecast = {
    _id: 'forecast-001',
    horizonHours: 24,
    points: [{ time: '2026-09-12T00:00:00Z', expectedMW: 450 }],
    riskWindows: [{ type: 'over_generation', start: '2026-09-12T12:00:00Z' }],
  };

  it('evaluates battery and demand context and saves recommendation in normal mode', async () => {
    batteryStatusTool.handler.mockResolvedValue({ chargePercent: 80, availableCapacityMWh: 1.0 });
    demandDataTool.handler.mockResolvedValue({ hourly: [{ demandMW: 120 }] });

    const mockRecData = {
      action: 'curtail',
      amountMW: 50,
      durationHours: 2,
      reasoning: 'Generation exceeds grid demand and battery capacity is near limit.',
      constraintsConsidered: ['battery_capacity', 'demand_forecast'],
    };

    const mockInvoke = jest.fn().mockResolvedValue({
      content: JSON.stringify(mockRecData),
    });
    ChatOpenAI.mockImplementation(() => ({ invoke: mockInvoke }));

    Recommendation.create.mockResolvedValue({
      _id: 'rec-001',
      ...mockRecData,
      toObject: () => ({ _id: 'rec-001', ...mockRecData }),
    });

    const state = {
      plant: mockPlant,
      forecast: mockForecast,
      simulationMode: false,
    };

    const nextState = await runDecisionAgent(state);

    expect(batteryStatusTool.handler).toHaveBeenCalled();
    expect(demandDataTool.handler).toHaveBeenCalled();
    expect(Recommendation.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'curtail', amountMW: 50 })
    );
    expect(nextState.recommendation.action).toBe('curtail');
  });

  it('does NOT save recommendation to database in simulation mode', async () => {
    batteryStatusTool.handler.mockResolvedValue({ chargePercent: 40 });
    demandDataTool.handler.mockResolvedValue({ hourly: [] });

    const mockRecData = {
      action: 'discharge_battery',
      amountMW: 20,
      durationHours: 1,
      reasoning: 'Simulation test',
      constraintsConsidered: ['battery_capacity'],
    };

    const mockInvoke = jest.fn().mockResolvedValue({
      content: JSON.stringify(mockRecData),
    });
    ChatOpenAI.mockImplementation(() => ({ invoke: mockInvoke }));

    const state = {
      plant: mockPlant,
      forecast: mockForecast,
      simulationMode: true,
      overrides: { demandFactor: 1.2 },
    };

    const nextState = await runDecisionAgent(state);

    expect(Recommendation.create).not.toHaveBeenCalled();
    expect(nextState.recommendation.action).toBe('discharge_battery');
  });

  it('falls back to "hold" action when LLM invocation fails', async () => {
    batteryStatusTool.handler.mockResolvedValue({});
    demandDataTool.handler.mockResolvedValue({});

    const mockInvoke = jest.fn().mockRejectedValue(new Error('LLM Parsing Error'));
    ChatOpenAI.mockImplementation(() => ({ invoke: mockInvoke }));

    Recommendation.create.mockImplementation(args => Promise.resolve({
      ...args,
      _id: 'rec-fallback',
      toObject: () => ({ ...args, _id: 'rec-fallback' }),
    }));

    const state = {
      plant: mockPlant,
      forecast: mockForecast,
      simulationMode: false,
    };

    const nextState = await runDecisionAgent(state);

    expect(nextState.recommendation.action).toBe('hold');
  });
});
