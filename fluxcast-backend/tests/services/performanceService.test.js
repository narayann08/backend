'use strict';

process.env.MONGODB_URI = 'mongodb://localhost:27017/fluxcast_test';
process.env.JWT_SECRET  = 'test_secret_key';
process.env.NODE_ENV    = 'test';

jest.mock('../../src/models/Telemetry');
jest.mock('../../src/models/ForecastResult');
jest.mock('../../src/models/WeatherSnapshot');

const mongoose = require('mongoose');
const Telemetry = require('../../src/models/Telemetry');
const ForecastResult = require('../../src/models/ForecastResult');
const WeatherSnapshot = require('../../src/models/WeatherSnapshot');
const {
  evaluatePlantPerformance,
  classify,
  weatherImpliedMW,
} = require('../../src/services/analytics/performanceService');

const NOW = new Date('2026-09-12T12:00:00.000Z');

const solarPlant = {
  _id: new mongoose.Types.ObjectId(),
  name: 'Bhadla Solar',
  type: 'solar',
  capacityMW: 500,
};

const windPlant = {
  _id: new mongoose.Types.ObjectId(),
  name: 'Muppandal Wind',
  type: 'wind',
  capacityMW: 200,
};

/** Wire up the three data sources the evaluator reads. */
function mockSources({ telemetry, forecast, weather }) {
  Telemetry.findOne.mockReturnValue({ sort: () => ({ lean: () => telemetry }) });
  ForecastResult.findOne.mockReturnValue({ sort: () => ({ lean: () => forecast }) });
  WeatherSnapshot.findOne.mockReturnValue({ sort: () => ({ lean: () => weather }) });
}

const forecastOf = (expectedMW, confidencePct = 75) => ({
  generatedAt: NOW,
  horizonHours: 24,
  points: [{ time: NOW, expectedMW, lowerBoundMW: expectedMW * 0.85, upperBoundMW: expectedMW * 1.15, confidencePct }],
});

const weatherOf = (fields) => ({
  generatedAt: NOW,
  hourly: [{ time: NOW, ...fields }],
});

describe('performanceService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('classify', () => {
    it('treats deviations inside ±10% as usual', () => {
      expect(classify(0)).toBe('usual');
      expect(classify(-9.9)).toBe('usual');
      expect(classify(10)).toBe('usual');
    });

    it('flags deviations beyond the band', () => {
      expect(classify(-25)).toBe('lower');
      expect(classify(42)).toBe('higher');
    });

    it('returns unknown without a baseline', () => {
      expect(classify(null)).toBe('unknown');
    });
  });

  describe('weatherImpliedMW', () => {
    it('returns zero for solar with no irradiance', () => {
      expect(weatherImpliedMW(solarPlant, { ghiWm2: 0, cloudCoverPct: 0 })).toBe(0);
    });

    it('derates solar output for cloud cover and heat', () => {
      const clear = weatherImpliedMW(solarPlant, { ghiWm2: 800, cloudCoverPct: 0, temperatureC: 25 });
      const cloudy = weatherImpliedMW(solarPlant, { ghiWm2: 800, cloudCoverPct: 80, temperatureC: 25 });
      expect(clear).toBeCloseTo(400, 0);
      expect(cloudy).toBeLessThan(clear);
    });

    it('applies the turbine curve for wind', () => {
      expect(weatherImpliedMW(windPlant, { windSpeedMs: 2 })).toBe(0);   // below cut-in
      expect(weatherImpliedMW(windPlant, { windSpeedMs: 30 })).toBe(0);  // above cut-out
      expect(weatherImpliedMW(windPlant, { windSpeedMs: 15 })).toBe(200); // rated output
      expect(weatherImpliedMW(windPlant, { windSpeedMs: 12 })).toBeCloseTo(200, 0);
    });
  });

  describe('evaluatePlantPerformance', () => {
    it('classifies output matching the forecast as usual', async () => {
      mockSources({
        telemetry: { timestamp: NOW, generationMW: 252, sensorStatus: 'ok', outage: false },
        forecast: forecastOf(250),
        weather: weatherOf({ ghiWm2: 700, cloudCoverPct: 10, temperatureC: 30 }),
      });

      const result = await evaluatePlantPerformance(solarPlant);

      expect(result.classification).toBe('usual');
      expect(result.underperforming).toBe(false);
      expect(result.deltaMW).toBe(2);
      expect(result.capacityFactorPct).toBe(50.4);
    });

    it('blames the weather when conditions came in worse than forecast', async () => {
      mockSources({
        telemetry: { timestamp: NOW, generationMW: 60, sensorStatus: 'ok', outage: false },
        forecast: forecastOf(250),
        // Heavy cloud: implied output falls far below the forecast assumption.
        weather: weatherOf({ ghiWm2: 200, cloudCoverPct: 90, temperatureC: 30 }),
      });

      const result = await evaluatePlantPerformance(solarPlant);

      expect(result.classification).toBe('lower');
      expect(result.underperforming).toBe(true);
      expect(result.reasons.map(r => r.code)).toContain('weather_below_forecast_assumption');
    });

    it('points at the equipment when output trails what the weather allows', async () => {
      mockSources({
        telemetry: { timestamp: NOW, generationMW: 10, sensorStatus: 'ok', outage: false },
        forecast: forecastOf(250),
        // Good conditions — roughly 380 MW implied — yet the plant reports 10 MW.
        weather: weatherOf({ ghiWm2: 800, cloudCoverPct: 5, temperatureC: 25 }),
      });

      const result = await evaluatePlantPerformance(solarPlant);

      expect(result.classification).toBe('lower');
      expect(result.reasons.map(r => r.code)).toContain('output_below_weather_potential');
      expect(result.reasons.map(r => r.code)).not.toContain('weather_below_forecast_assumption');
    });

    it('surfaces sensor faults and outages', async () => {
      mockSources({
        telemetry: { timestamp: NOW, generationMW: 0, sensorStatus: 'offline', outage: true },
        forecast: forecastOf(250),
        weather: weatherOf({ ghiWm2: 800, cloudCoverPct: 5, temperatureC: 25 }),
      });

      const result = await evaluatePlantPerformance(solarPlant);
      const codes = result.reasons.map(r => r.code);

      expect(codes).toContain('outage');
      expect(codes).toContain('sensor_offline');
    });

    it('reports unknown when no forecast baseline exists', async () => {
      mockSources({
        telemetry: { timestamp: NOW, generationMW: 100, sensorStatus: 'ok', outage: false },
        forecast: null,
        weather: null,
      });

      const result = await evaluatePlantPerformance(solarPlant);

      expect(result.classification).toBe('unknown');
      expect(result.reasons.map(r => r.code)).toContain('no_forecast_baseline');
    });

    it('does not treat a quiet night as a deviation', async () => {
      mockSources({
        telemetry: { timestamp: NOW, generationMW: 0, sensorStatus: 'ok', outage: false },
        forecast: forecastOf(0),
        weather: weatherOf({ ghiWm2: 0, cloudCoverPct: 10, temperatureC: 22 }),
      });

      const result = await evaluatePlantPerformance(solarPlant);

      expect(result.classification).toBe('usual');
      expect(result.deltaPct).toBe(0);
    });
  });
});
