'use strict';
const telemetryTool = require('../../src/services/mcp-tools/telemetryTool');
const ragRetrieverTool = require('../../src/services/mcp-tools/ragRetrieverTool');
const ForecastResult = require('../../src/models/ForecastResult');
const WeatherSnapshot = require('../../src/models/WeatherSnapshot');

jest.mock('../../src/services/mcp-tools/telemetryTool');
jest.mock('../../src/services/mcp-tools/ragRetrieverTool');
jest.mock('../../src/models/ForecastResult');
jest.mock('../../src/models/WeatherSnapshot');

const { runForecastingAgent } = require('../../src/services/agents/forecastingAgent');

describe('Agent: forecastingAgent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // No stored past weather unless a test provides some.
    WeatherSnapshot.find.mockReturnValue({
      sort: () => ({ lean: () => Promise.resolve([]) }),
    });
    ForecastResult.create.mockImplementation((doc) =>
      Promise.resolve({ ...doc, _id: 'forecast-1', toObject: () => ({ ...doc, _id: 'forecast-1' }) })
    );
  });

  const solarPlant = {
    _id: '507f1f77bcf86cd799439011',
    name: 'Bhadla Solar 1',
    type: 'solar',
    capacityMW: 500,
    hasLimitedHistory: false,
  };

  const newPlant = { ...solarPlant, _id: '507f1f77bcf86cd799439012', name: 'New Solar Unit', capacityMW: 100, hasLimitedHistory: true };

  /** One clear day: dark until 06:00, peaking at noon. */
  const dayAhead = Array.from({ length: 24 }, (_, i) => ({
    time: new Date(Date.UTC(2026, 8, 12, i)).toISOString(),
    ghiWm2: i >= 6 && i <= 18 ? Math.round(1000 * Math.sin(((i - 6) / 12) * Math.PI)) : 0,
    cloudCoverPct: 10,
    temperatureC: 25,
    windSpeedMs: 5,
  }));

  const state = (plant = solarPlant, horizon = 24) => ({
    plant,
    weatherSnapshot: { hourly: dayAhead },
    horizon,
    jobId: 'job-1',
  });

  it('projects the weather through the power curve instead of guessing', async () => {
    telemetryTool.handler.mockResolvedValue([]);

    const { forecast } = await runForecastingAgent(state());
    const points = forecast.points;

    expect(points).toHaveLength(24);
    // Night hours carry no irradiance, so they must be exactly zero…
    expect(points[0].expectedMW).toBe(0);
    expect(points[3].expectedMW).toBe(0);
    // …and midday must track the irradiance peak, not a flat constant.
    expect(points[12].expectedMW).toBeGreaterThan(400);
    expect(new Set(points.map((p) => p.expectedMW)).size).toBeGreaterThan(5);
  });

  it('aligns forecast times to the weather hours it was given', async () => {
    telemetryTool.handler.mockResolvedValue([]);

    const { forecast } = await runForecastingAgent(state());

    forecast.points.forEach((point, i) => {
      expect(new Date(point.time).toISOString()).toBe(new Date(dayAhead[i].time).toISOString());
      expect(new Date(point.time).getUTCMinutes()).toBe(0);
    });
  });

  it('fits a scale factor from the plant\'s own measured output', async () => {
    // Two days of history, on which the site consistently delivered 60% of
    // what the weather implied — one day of daylight is under the sample floor.
    const pastWeather = [
      ...dayAhead.map((h) => ({ ...h, time: new Date(new Date(h.time).getTime() - 48 * 3600e3).toISOString() })),
      ...dayAhead.map((h) => ({ ...h, time: new Date(new Date(h.time).getTime() - 24 * 3600e3).toISOString() })),
    ];
    const telemetry = pastWeather
      .filter((h) => h.ghiWm2 > 0)
      .map((h) => ({
        timestamp: new Date(h.time),
        generationMW: solarPlant.capacityMW * (h.ghiWm2 / 1000) * 0.6,
        sensorStatus: 'ok',
        outage: false,
      }));
    telemetryTool.handler.mockResolvedValue(telemetry);
    WeatherSnapshot.find.mockReturnValue({
      sort: () => ({ lean: () => Promise.resolve([{ hourly: pastWeather }]) }),
    });

    const { forecast } = await runForecastingAgent(state());

    expect(forecast.calibrationFactor).toBeCloseTo(0.6, 1);
    expect(forecast.calibrationSamples).toBeGreaterThanOrEqual(12);
    expect(forecast.points[12].expectedMW).toBeCloseTo(500 * 0.6, 0);
  });

  it('widens the band and lowers confidence further into the horizon', async () => {
    telemetryTool.handler.mockResolvedValue([]);

    const { forecast } = await runForecastingAgent(state());
    const daylight = forecast.points.filter((p) => p.expectedMW > 0);
    const first = daylight[0];
    const last = daylight[daylight.length - 1];

    expect(last.confidencePct).toBeLessThan(first.confidencePct);
    const spread = (p) => (p.upperBoundMW - p.lowerBoundMW) / p.expectedMW;
    expect(spread(last)).toBeGreaterThan(spread(first));
  });

  it('flags an operational risk window when sensors report a fault', async () => {
    telemetryTool.handler.mockResolvedValue([
      { timestamp: new Date('2026-09-12T05:00:00Z'), generationMW: 0, sensorStatus: 'ok', outage: false },
      { timestamp: new Date('2026-09-12T06:00:00Z'), generationMW: 0, sensorStatus: 'ok', outage: true },
    ]);

    const { forecast } = await runForecastingAgent(state());

    const operational = forecast.riskWindows.find((w) => w.type === 'operational_risk');
    expect(operational).toBeDefined();
    expect(operational.magnitudePct).toBeGreaterThan(0);
    expect(operational.detail).toMatch(/outage/i);
  });

  it('borrows a calibration factor from similar plants when a site has no history', async () => {
    telemetryTool.handler.mockResolvedValue([]);
    ragRetrieverTool.handler.mockResolvedValue({
      results: [{ metadata: { calibrationFactor: 0.8 } }, { metadata: { calibrationFactor: 0.9 } }],
    });

    const { forecast } = await runForecastingAgent(state(newPlant));

    expect(ragRetrieverTool.handler).toHaveBeenCalledWith(
      expect.objectContaining({ plantType: 'solar', topK: 3 })
    );
    expect(forecast.calibrationFactor).toBeCloseTo(0.85, 2);
  });

  it('does not reach for RAG when the plant has its own history', async () => {
    telemetryTool.handler.mockResolvedValue([]);
    await runForecastingAgent(state());
    expect(ragRetrieverTool.handler).not.toHaveBeenCalled();
  });

  it('refuses to forecast without weather rather than inventing a curve', async () => {
    telemetryTool.handler.mockResolvedValue([]);
    await expect(
      runForecastingAgent({ ...state(), weatherSnapshot: { hourly: [] } })
    ).rejects.toThrow('without a weather snapshot');
    expect(ForecastResult.create).not.toHaveBeenCalled();
  });

  it('keeps simulation runs out of the plant\'s forecast history', async () => {
    telemetryTool.handler.mockResolvedValue([]);
    const { forecast } = await runForecastingAgent({ ...state(), simulationMode: true });
    expect(forecast.points).toHaveLength(24);
    expect(ForecastResult.create).not.toHaveBeenCalled();
  });
});
