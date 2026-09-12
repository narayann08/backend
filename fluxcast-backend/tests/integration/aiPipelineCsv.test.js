'use strict';
process.env.MONGODB_URI = 'mongodb://localhost:27017/fluxcast_test';
process.env.JWT_SECRET  = 'test_secret_key';
process.env.NODE_ENV    = 'test';

const path = require('path');
const { loadTelemetryFixture } = require('../helpers/csvLoader');

/**
 * End-to-end AI pipeline test driven by mock SCADA telemetry (tests/fixtures/mock_telemetry.csv).
 *
 * There is no live X.AI Grok key, MongoDB Atlas cluster, or external weather API access in this
 * environment, so — exactly like the rest of this repo's test suite — every external boundary is
 * mocked. The one piece that needs care is the LLM: instead of a canned/fixed response, `completeJson`
 * (the shared xAI/Grok client wrapper — see src/services/llm/xaiClient.js) is replaced with a
 * deterministic stand-in that implements the *exact* physics/decision rules each agent's own system
 * prompt specifies (see src/services/agents/*.js). That lets this test validate the real orchestration
 * — WeatherReasoning -> Forecasting -> Decision -> Explainability, MCP tool wiring, risk-window
 * propagation, and alerting — against realistic, CSV-sourced generation data, without depending on
 * network access or non-deterministic model output.
 */

// ── Mock all external MCP tools & persistence boundaries ─────────────────────
jest.mock('../../src/services/mcp-tools/openMeteoTool');
jest.mock('../../src/services/mcp-tools/nasaPowerTool');
jest.mock('../../src/services/mcp-tools/telemetryTool');
jest.mock('../../src/services/mcp-tools/ragRetrieverTool');
jest.mock('../../src/services/mcp-tools/notificationTool');
jest.mock('../../src/models/WeatherSnapshot');
jest.mock('../../src/models/ForecastResult');
jest.mock('../../src/models/Recommendation');
jest.mock('../../src/services/llm/xaiClient');

const openMeteoTool     = require('../../src/services/mcp-tools/openMeteoTool');
const nasaPowerTool     = require('../../src/services/mcp-tools/nasaPowerTool');
const telemetryTool     = require('../../src/services/mcp-tools/telemetryTool');
const ragRetrieverTool  = require('../../src/services/mcp-tools/ragRetrieverTool');
const notificationTool  = require('../../src/services/mcp-tools/notificationTool');
const WeatherSnapshot   = require('../../src/models/WeatherSnapshot');
const ForecastResult    = require('../../src/models/ForecastResult');
const Recommendation    = require('../../src/models/Recommendation');
const { completeJson }  = require('../../src/services/llm/xaiClient');

const { runForecastWorkflow } = require('../../src/services/graph/forecastWorkflow');

const FIXTURE_PATH = path.join(__dirname, '..', 'fixtures', 'mock_telemetry.csv');
const HORIZON = 24;

// ── Physics helpers mirroring each agent's documented rules exactly ─────────
function solarWeatherHour(i) {
  const hourOfDay = (10 + i) % 24; // deterministic day cycle, independent of wall-clock time
  const ghiWm2 = hourOfDay >= 6 && hourOfDay <= 18
    ? Math.round(900 * Math.sin(((hourOfDay - 6) / 12) * Math.PI))
    : 0;
  return { hourOfDay, ghiWm2, cloudCoverPct: 10, temperatureC: 25 };
}

function windWeatherHour(i) {
  const hourOfDay = (10 + i) % 24;
  const windSpeedMs = 8 + 5 * Math.cos((2 * Math.PI * hourOfDay) / 24);
  return { hourOfDay, windSpeedMs };
}

function solarExpectedMW(capacityMW, w) {
  if (w.ghiWm2 <= 0) return 0;
  const tempFactor = 1 - Math.max(0, w.temperatureC - 25) * 0.004;
  return capacityMW * (w.ghiWm2 / 1000) * (1 - (w.cloudCoverPct / 100) * 0.7) * tempFactor;
}

function windExpectedMW(capacityMW, w) {
  const { windSpeedMs: v } = w;
  if (v < 3 || v > 25) return 0;
  if (v <= 12) return capacityMW * Math.pow((v - 3) / 9, 3);
  return capacityMW;
}

function buildScenario(plant, telemetry) {
  const isSolar = plant.type === 'solar';
  const weatherFn = isSolar ? solarWeatherHour : windWeatherHour;
  const genFn = isSolar ? solarExpectedMW : windExpectedMW;

  const weatherHourly = Array.from({ length: HORIZON }, (_, i) => {
    const w = weatherFn(i);
    const time = new Date(Date.now() + i * 3600 * 1000).toISOString();
    return isSolar
      ? { time, cloudCoverPct: w.cloudCoverPct, ghiWm2: w.ghiWm2, dniWm2: w.ghiWm2, rainProbabilityPct: 5, temperatureC: w.temperatureC, humidityPct: 40, windSpeedMs: 2, windDirectionDeg: 90, windGustMs: 3, turbulenceIndex: 0.1 }
      : { time, cloudCoverPct: 30, ghiWm2: 0, dniWm2: 0, rainProbabilityPct: 5, temperatureC: 22, humidityPct: 60, windSpeedMs: w.windSpeedMs, windDirectionDeg: 200, windGustMs: w.windSpeedMs + 2, turbulenceIndex: 0.2 };
  });

  const points = weatherHourly.map((wh, i) => {
    const w = weatherFn(i);
    const expectedMW = Math.max(0, genFn(plant.capacityMW, w));
    return {
      time: wh.time,
      expectedMW: Math.round(expectedMW * 100) / 100,
      lowerBoundMW: Math.round(expectedMW * 0.85 * 100) / 100,
      upperBoundMW: Math.round(expectedMW * 1.15 * 100) / 100,
      confidencePct: 75,
    };
  });

  const recentTelemetry = telemetry.slice(-10);
  const hasOperationalRisk = recentTelemetry.some(t => t.sensorStatus === 'degraded' || t.outage === true);
  const riskWindows = [];
  if (hasOperationalRisk) {
    riskWindows.push({
      start: recentTelemetry[0].timestamp.toISOString(),
      end: recentTelemetry[recentTelemetry.length - 1].timestamp.toISOString(),
      type: 'operational_risk',
    });
  }

  // Decision rules (src/services/agents/decisionAgent.js system prompt), evaluated at hour 0.
  const firstPointMW = points[0].expectedMW;
  const demandMW0 = 150; // demandDataTool stub: base 150 + sin(0) * 30 = 150 at i=0
  const batteryChargePercent = 65; // batteryStatusTool mock is a fixed constant
  let action = 'hold';
  if (firstPointMW > demandMW0) {
    action = batteryChargePercent >= 100 ? 'export' : 'charge_battery';
  } else if (batteryChargePercent > 20) {
    action = 'discharge_battery';
  }

  return {
    weatherHourly,
    forecastData: { points, riskWindows },
    decisionData: {
      action,
      amountMW: Math.abs(demandMW0 - firstPointMW),
      durationHours: 1,
      reasoning: `Generation ${firstPointMW}MW vs demand ${demandMW0}MW at battery ${batteryChargePercent}% SoC.`,
      constraintsConsidered: ['battery_capacity', 'demand_forecast'],
    },
    explanationData: {
      summary: `${plant.name}: ${action} recommended given current generation/demand balance.`,
      factors: hasOperationalRisk
        ? ['generation_forecast', 'sensor_reliability']
        : ['generation_forecast', 'grid_demand'],
    },
  };
}

function installFakeLlm(scenario) {
  completeJson.mockImplementation(async ({ system }) => {
    if (system.includes('Weather-Reasoning Agent')) return scenario.weatherHourly;
    if (system.includes('Forecasting Agent')) return scenario.forecastData;
    if (system.includes('Decision Agent')) return scenario.decisionData;
    if (system.includes('Explainability Agent')) return scenario.explanationData;
    throw new Error('Fake LLM received an unrecognised system prompt');
  });
}

function mockPersistence() {
  WeatherSnapshot.create.mockImplementation(async (doc) => ({ ...doc, _id: 'ws-1', toObject: () => ({ ...doc, _id: 'ws-1' }) }));
  ForecastResult.create.mockImplementation(async (doc) => ({ ...doc, _id: 'fr-1', toObject: () => ({ ...doc, _id: 'fr-1' }) }));
  Recommendation.create.mockImplementation(async (doc) => ({ ...doc, _id: 'rec-1', toObject: () => ({ ...doc, _id: 'rec-1' }) }));
  notificationTool.handler.mockResolvedValue({ success: true, alertId: 'alert-1' });
  openMeteoTool.handler.mockResolvedValue({ hourly: [] }); // unused: weather agent's LLM output is faked directly
  nasaPowerTool.handler.mockResolvedValue({ available: false });
  ragRetrieverTool.handler.mockResolvedValue({ results: [] });
}

describe('AI pipeline — CSV-driven mock telemetry (tests/fixtures/mock_telemetry.csv)', () => {
  const fixture = loadTelemetryFixture(FIXTURE_PATH);
  const plantEntries = Array.from(fixture.values());

  beforeEach(() => {
    jest.clearAllMocks();
    mockPersistence();
  });

  it('fixture contains both a solar and a wind plant with injected sensor anomalies', () => {
    expect(plantEntries.length).toBe(2);
    const types = plantEntries.map(e => e.plant.type).sort();
    expect(types).toEqual(['solar', 'wind']);
    for (const { telemetry } of plantEntries) {
      expect(telemetry.length).toBe(96);
      const recent = telemetry.slice(-10);
      expect(recent.some(t => t.sensorStatus === 'degraded')).toBe(true);
      expect(recent.some(t => t.outage === true)).toBe(true);
    }
  });

  it.each(plantEntries)('runs the full 4-agent workflow for $plant.name ($plant.type)', async ({ plant, telemetry }) => {
    const scenario = buildScenario(plant, telemetry);
    installFakeLlm(scenario);
    telemetryTool.handler.mockResolvedValue(telemetry);

    const result = await runForecastWorkflow({
      plant,
      horizon: HORIZON,
      jobId: `csv-test-${plant.type}`,
      simulationMode: false,
    });

    // Forecasting agent: full horizon, non-negative generation, correct day/night physics
    expect(telemetryTool.handler).toHaveBeenCalledWith({ plantId: plant._id.toString(), days: 4 });
    expect(result.forecast.points.length).toBe(HORIZON);
    for (const p of result.forecast.points) {
      expect(p.expectedMW).toBeGreaterThanOrEqual(0);
    }
    if (plant.type === 'solar') {
      // Night-hour points (per our deterministic curve) must be exactly zero.
      const nightPoints = result.forecast.points.filter((_, i) => {
        const h = (10 + i) % 24;
        return h < 6 || h > 18;
      });
      expect(nightPoints.length).toBeGreaterThan(0);
      expect(nightPoints.every(p => p.expectedMW === 0)).toBe(true);
    }

    // The injected degraded/outage telemetry rows must surface as an operational_risk window
    expect(result.forecast.riskWindows.some(rw => rw.type === 'operational_risk')).toBe(true);

    // Decision agent: valid action from the allowed enum, persisted via Recommendation model
    const allowedActions = ['charge_battery', 'discharge_battery', 'curtail', 'export', 'activate_backup', 'hold'];
    expect(allowedActions).toContain(result.recommendation.action);
    expect(Recommendation.create).toHaveBeenCalledTimes(1);

    // Explainability agent: human-readable summary + factors, and an alert raised for the risk window
    expect(typeof result.explanation).toBe('string');
    expect(result.explanation.length).toBeGreaterThan(0);
    expect(Array.isArray(result.explanationFactors)).toBe(true);
    expect(notificationTool.handler).toHaveBeenCalledWith(
      expect.objectContaining({ plantId: plant._id.toString(), type: 'sensor_fault', severity: 'high' })
    );
  });

  it('does not persist or alert when run in simulationMode (what-if / /v1/simulate contract)', async () => {
    const { plant, telemetry } = plantEntries[0];
    const scenario = buildScenario(plant, telemetry);
    installFakeLlm(scenario);
    telemetryTool.handler.mockResolvedValue(telemetry);

    const result = await runForecastWorkflow({
      plant,
      horizon: HORIZON,
      simulationMode: true,
      scenario: 'What if demand spikes 20%?',
      overrides: { demandChangePct: 20 },
    });

    expect(Recommendation.create).not.toHaveBeenCalled();
    expect(notificationTool.handler).not.toHaveBeenCalled();
    expect(result.recommendation.action).toBeDefined();
  });
});
