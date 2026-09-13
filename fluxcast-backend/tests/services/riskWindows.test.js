'use strict';
const {
  detectRiskWindows,
  severityForRisk,
  ALERT_TYPE_BY_RISK,
} = require('../../src/services/forecast/riskWindows');

const solar = { _id: 's1', type: 'solar', capacityMW: 100 };
const wind = { _id: 'w1', type: 'wind', capacityMW: 100 };

/** Points on the hour from a given IST hour, at the given outputs. */
function pointsFrom(istStartHour, values) {
  return values.map((expectedMW, i) => ({
    // 00:00 IST is 18:30 UTC the previous day.
    time: new Date(Date.UTC(2026, 8, 12, istStartHour + i, 0) - 5.5 * 3600e3).toISOString(),
    expectedMW,
  }));
}

describe('riskWindows', () => {
  describe('detectRiskWindows', () => {
    it('flags sustained output at the top of the range', () => {
      const points = pointsFrom(10, [96, 98, 99, 40]);
      const [window] = detectRiskWindows({ plant: solar, points });

      expect(window.type).toBe('over_generation');
      expect(window.magnitudePct).toBeCloseTo(99, 0);
      expect(window.severity).toBe('medium');
    });

    it('ignores a brief excursion above the threshold', () => {
      const points = pointsFrom(10, [96, 98, 40, 40]);
      expect(detectRiskWindows({ plant: solar, points })).toHaveLength(0);
    });

    it('grades an over-generation window at nameplate as high', () => {
      const points = pointsFrom(10, [100, 101, 100]);
      const [window] = detectRiskWindows({ plant: solar, points });
      expect(window.severity).toBe('high');
    });

    it('only counts solar under-generation inside the peak-sun window', () => {
      // 05:00–07:00 IST is dark: low output there is not a risk.
      expect(detectRiskWindows({ plant: solar, points: pointsFrom(5, [0, 0, 1]) })).toHaveLength(0);

      const [midday] = detectRiskWindows({ plant: solar, points: pointsFrom(11, [4, 3, 5]) });
      expect(midday.type).toBe('under_generation');
      expect(midday.severity).toBe('high'); // under 5% of nameplate at noon
    });

    it('takes a longer run to flag a becalmed wind farm', () => {
      expect(detectRiskWindows({ plant: wind, points: pointsFrom(2, [5, 5, 5]) })).toHaveLength(0);

      const [window] = detectRiskWindows({ plant: wind, points: pointsFrom(2, Array(6).fill(15)) });
      expect(window.type).toBe('under_generation');
      expect(window.severity).toBe('low'); // 15% of nameplate is thin, not critical
    });

    it('raises an operational window from the plant\'s own sensor reports', () => {
      const telemetry = [
        { timestamp: new Date('2026-09-12T04:00:00Z'), sensorStatus: 'ok', outage: false },
        { timestamp: new Date('2026-09-12T05:00:00Z'), sensorStatus: 'degraded', outage: false },
        { timestamp: new Date('2026-09-12T06:00:00Z'), sensorStatus: 'offline', outage: true },
      ];
      const [window] = detectRiskWindows({ plant: solar, points: pointsFrom(10, [50]), telemetry });

      expect(window.type).toBe('operational_risk');
      expect(window.hasOutage).toBe(true);
      expect(window.severity).toBe('high');
      expect(window.start).toEqual(new Date('2026-09-12T05:00:00Z'));
      expect(window.end).toEqual(new Date('2026-09-12T06:00:00Z'));
    });

    it('says nothing when the plant is simply running normally', () => {
      const telemetry = [{ timestamp: new Date(), sensorStatus: 'ok', outage: false }];
      expect(detectRiskWindows({ plant: solar, points: pointsFrom(10, [50, 55, 60]), telemetry })).toEqual([]);
    });

    it('carries a detail an operator can read', () => {
      const [window] = detectRiskWindows({ plant: solar, points: pointsFrom(10, [100, 100, 100]) });
      expect(window.detail).toMatch(/100\.0 MW/);
      expect(window.detail).toMatch(/consecutive hours/);
    });
  });

  describe('severityForRisk', () => {
    it('grades by magnitude rather than by category', () => {
      expect(severityForRisk({ type: 'over_generation', magnitudePct: 101 })).toBe('high');
      expect(severityForRisk({ type: 'over_generation', magnitudePct: 96 })).toBe('medium');

      expect(severityForRisk({ type: 'under_generation', magnitudePct: 2 })).toBe('high');
      expect(severityForRisk({ type: 'under_generation', magnitudePct: 8 })).toBe('medium');
      expect(severityForRisk({ type: 'under_generation', magnitudePct: 18 })).toBe('low');
    });

    it('treats any recorded outage as high', () => {
      expect(severityForRisk({ type: 'operational_risk', hasOutage: true, magnitudePct: 1 })).toBe('high');
      expect(severityForRisk({ type: 'operational_risk', magnitudePct: 5 })).toBe('medium');
      expect(severityForRisk({ type: 'operational_risk', magnitudePct: 40 })).toBe('high');
    });
  });

  it('maps each risk to the alert type an operator would recognise', () => {
    expect(ALERT_TYPE_BY_RISK.over_generation).toBe('curtailment_risk');
    expect(ALERT_TYPE_BY_RISK.under_generation).toBe('shortfall_risk');
    expect(ALERT_TYPE_BY_RISK.operational_risk).toBe('sensor_fault');
  });
});
