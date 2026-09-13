'use strict';
const {
  impliedMW,
  calibrate,
  buildForecastPoints,
  MIN_CALIBRATION_SAMPLES,
  CALIBRATION_BOUNDS,
} = require('../../src/services/forecast/generationModel');

const solar = { _id: 's1', type: 'solar', capacityMW: 300 };
const wind = { _id: 'w1', type: 'wind', capacityMW: 150 };

/** A clear day on the hour, dark before 06:00 and after 18:00. */
const clearDay = Array.from({ length: 24 }, (_, i) => ({
  time: new Date(Date.UTC(2026, 8, 12, i)).toISOString(),
  ghiWm2: i >= 6 && i <= 18 ? Math.round(1000 * Math.sin(((i - 6) / 12) * Math.PI)) : 0,
  temperatureC: 25,
  windSpeedMs: 7,
}));

describe('generationModel', () => {
  describe('impliedMW', () => {
    it('returns nameplate at standard irradiance and rating temperature', () => {
      expect(impliedMW(solar, { ghiWm2: 1000, temperatureC: 25 })).toBeCloseTo(300, 1);
    });

    it('is zero in the dark and never negative', () => {
      expect(impliedMW(solar, { ghiWm2: 0 })).toBe(0);
      expect(impliedMW(solar, { ghiWm2: -5 })).toBe(0);
    });

    it('derates above the rating temperature', () => {
      const rated = impliedMW(solar, { ghiWm2: 800, temperatureC: 25 });
      const hot = impliedMW(solar, { ghiWm2: 800, temperatureC: 45 });
      expect(hot).toBeLessThan(rated);
      expect(hot / rated).toBeCloseTo(1 - 20 * 0.004, 3);
    });

    it('never exceeds nameplate, however bright', () => {
      expect(impliedMW(solar, { ghiWm2: 1400, temperatureC: 20 })).toBe(solar.capacityMW);
    });

    it('respects the turbine cut-in, rated and cut-out speeds', () => {
      expect(impliedMW(wind, { windSpeedMs: 2.9 })).toBe(0);
      expect(impliedMW(wind, { windSpeedMs: 25.1 })).toBe(0);
      expect(impliedMW(wind, { windSpeedMs: 12 })).toBe(wind.capacityMW);
      expect(impliedMW(wind, { windSpeedMs: 20 })).toBe(wind.capacityMW);
    });

    it('follows the cubic power curve between cut-in and rated', () => {
      const at7 = impliedMW(wind, { windSpeedMs: 7 }) / wind.capacityMW;
      const expected = (7 ** 3 - 3 ** 3) / (12 ** 3 - 3 ** 3);
      expect(at7).toBeCloseTo(expected, 4);
    });

    it('returns null when the driving variable is missing', () => {
      expect(impliedMW(solar, { temperatureC: 30 })).toBeNull();
      expect(impliedMW(wind, { ghiWm2: 500 })).toBeNull();
      expect(impliedMW(solar, null)).toBeNull();
    });
  });

  describe('calibrate', () => {
    /** Telemetry for `days` of `clearDay`, delivering `ratio` of what weather implies. */
    function history(plant, ratio, days = 2) {
      const weather = [];
      const telemetry = [];
      for (let d = 1; d <= days; d += 1) {
        for (const hour of clearDay) {
          const time = new Date(new Date(hour.time).getTime() - d * 24 * 3600e3).toISOString();
          weather.push({ ...hour, time });
          telemetry.push({
            timestamp: new Date(time),
            generationMW: (impliedMW(plant, hour) || 0) * ratio,
            sensorStatus: 'ok',
            outage: false,
          });
        }
      }
      return { weather, telemetry };
    }

    it('recovers the ratio the plant actually delivers', () => {
      const { weather, telemetry } = history(solar, 0.7);
      const result = calibrate(solar, telemetry, weather);
      expect(result.calibrated).toBe(true);
      expect(result.factor).toBeCloseTo(0.7, 2);
      expect(result.samples).toBeGreaterThanOrEqual(MIN_CALIBRATION_SAMPLES);
    });

    it('stays uncalibrated rather than fitting noise from too few hours', () => {
      const { weather, telemetry } = history(solar, 0.7, 1);
      const result = calibrate(solar, telemetry.slice(0, 4), weather);
      expect(result.calibrated).toBe(false);
      expect(result.factor).toBe(1);
    });

    it('clamps an implausible fit instead of trusting it', () => {
      const { weather, telemetry } = history(solar, 5);
      const result = calibrate(solar, telemetry, weather);
      expect(result.factor).toBeLessThanOrEqual(CALIBRATION_BOUNDS.max);
    });

    it('excludes readings a faulty sensor produced, and flags them', () => {
      const { weather, telemetry } = history(solar, 0.7);
      const spoiled = telemetry.map((t, i) =>
        i % 2 === 0 ? { ...t, sensorStatus: 'degraded', generationMW: 0 } : t
      );
      const result = calibrate(solar, spoiled, weather);
      expect(result.degraded).toBe(true);
      expect(result.factor).toBeCloseTo(0.7, 2); // the zeros must not drag the fit down
    });

    it('sizes the band from the fit residuals', () => {
      const { weather, telemetry } = history(solar, 0.7);
      const tight = calibrate(solar, telemetry, weather);
      const noisy = calibrate(
        solar,
        telemetry.map((t, i) => ({ ...t, generationMW: t.generationMW * (i % 2 ? 0.5 : 1.5) })),
        weather
      );
      expect(noisy.bandPct).toBeGreaterThan(tight.bandPct);
    });
  });

  describe('buildForecastPoints', () => {
    const calibration = { factor: 0.8, bandPct: 0.1, calibrated: true, degraded: false, samples: 40 };

    it('emits one point per weather hour, on that hour', () => {
      const points = buildForecastPoints({ plant: solar, hourly: clearDay, calibration, horizon: 24 });
      expect(points).toHaveLength(24);
      points.forEach((p, i) => {
        expect(new Date(p.time).toISOString()).toBe(new Date(clearDay[i].time).toISOString());
      });
    });

    it('applies the calibration factor', () => {
      const points = buildForecastPoints({ plant: solar, hourly: clearDay, calibration, horizon: 24 });
      const noon = points[12];
      expect(noon.expectedMW).toBeCloseTo((impliedMW(solar, clearDay[12]) || 0) * 0.8, 1);
    });

    it('keeps bounds ordered and inside the physical range', () => {
      const points = buildForecastPoints({ plant: solar, hourly: clearDay, calibration, horizon: 24 });
      for (const p of points) {
        expect(p.lowerBoundMW).toBeLessThanOrEqual(p.expectedMW);
        expect(p.upperBoundMW).toBeGreaterThanOrEqual(p.expectedMW);
        expect(p.lowerBoundMW).toBeGreaterThanOrEqual(0);
        expect(p.upperBoundMW).toBeLessThanOrEqual(solar.capacityMW);
      }
    });

    it('loses confidence with horizon and with a shaky calibration', () => {
      const confident = buildForecastPoints({ plant: solar, hourly: clearDay, calibration, horizon: 24 });
      const shaky = buildForecastPoints({
        plant: solar,
        hourly: clearDay,
        calibration: { ...calibration, calibrated: false, degraded: true },
        horizon: 24,
      });
      expect(confident[23].confidencePct).toBeLessThan(confident[0].confidencePct);
      expect(shaky[0].confidencePct).toBeLessThan(confident[0].confidencePct);
      expect(shaky.every((p) => p.confidencePct >= 25)).toBe(true);
    });

    it('honours the horizon even when more weather is available', () => {
      const points = buildForecastPoints({ plant: solar, hourly: clearDay, calibration, horizon: 6 });
      expect(points).toHaveLength(6);
    });
  });
});
