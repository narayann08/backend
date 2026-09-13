'use strict';
const { istHourOfDay } = require('../../utils/istTime');

/**
 * Risk windows, derived from the forecast curve rather than asked for in a
 * prompt. The rules below are the ones the project already documented; they
 * are applied here so a window is reproducible and carries a magnitude, which
 * is what lets an alert be graded instead of every alert arriving as "high".
 */

const OVER_GENERATION = {
  /** Fraction of nameplate above which output is a grid problem, not a good day. */
  THRESHOLD: 0.95,
  MIN_HOURS: 3,
};

/*
 * How far back a sensor fault still counts as a live operational risk.
 *
 * The forecaster hands this function its calibration window — two weeks of
 * readings — but "is the plant healthy right now" is a different question from
 * "what has this plant been delivering". Without a bound, a fault from last
 * week keeps raising today's alert. Half a day is still actionable for an
 * operator; a fortnight is history. Measured from the newest reading rather
 * than the wall clock, so a backfilled or replayed series behaves the same.
 */
const OPERATIONAL_LOOKBACK_HOURS = 12;

const UNDER_GENERATION = {
  THRESHOLD: 0.2,
  /** Solar is only expected to deliver in the middle of the day (IST). */
  SOLAR_WINDOW: { from: 10, to: 16 },
  SOLAR_MIN_HOURS: 2,
  /** Wind has no daily window, so it takes a longer run to count as a risk. */
  WIND_MIN_HOURS: 6,
};

/** Group consecutive matching points into runs. */
function runsOf(points, predicate) {
  const runs = [];
  let current = null;

  points.forEach((point, index) => {
    if (predicate(point, index)) {
      if (!current) current = [];
      current.push(point);
    } else if (current) {
      runs.push(current);
      current = null;
    }
  });
  if (current) runs.push(current);

  return runs;
}

const pctOfCapacity = (mw, capacityMW) => (capacityMW > 0 ? (mw / capacityMW) * 100 : 0);

/**
 * @param {object} params
 * @param {object} params.plant
 * @param {Array<object>} params.points - Forecast points
 * @param {Array<object>} [params.telemetry] - Recent readings, for equipment risk
 * @returns {Array<{start: Date, end: Date, type: string, magnitudePct: number, detail: string}>}
 */
function detectRiskWindows({ plant, points = [], telemetry = [] }) {
  const windows = [];
  const capacity = plant.capacityMW || 0;

  // ── Over-generation: sustained output the grid may not be able to take ───
  for (const run of runsOf(points, (p) => p.expectedMW >= capacity * OVER_GENERATION.THRESHOLD)) {
    if (run.length < OVER_GENERATION.MIN_HOURS) continue;
    const peak = Math.max(...run.map((p) => p.expectedMW));
    windows.push({
      start: new Date(run[0].time),
      end: new Date(run[run.length - 1].time),
      type: 'over_generation',
      magnitudePct: Number(pctOfCapacity(peak, capacity).toFixed(1)),
      detail:
        `Forecast peaks at ${peak.toFixed(1)} MW (${pctOfCapacity(peak, capacity).toFixed(0)}% of ` +
        `nameplate) across ${run.length} consecutive hours.`,
    });
  }

  // ── Under-generation: a shortfall against what the site should deliver ───
  const isSolar = plant.type === 'solar';
  const minHours = isSolar ? UNDER_GENERATION.SOLAR_MIN_HOURS : UNDER_GENERATION.WIND_MIN_HOURS;
  const inScope = (point) => {
    if (!isSolar) return true;
    const hour = istHourOfDay(new Date(point.time));
    return hour >= UNDER_GENERATION.SOLAR_WINDOW.from && hour <= UNDER_GENERATION.SOLAR_WINDOW.to;
  };

  for (const run of runsOf(
    points,
    (p) => inScope(p) && p.expectedMW < capacity * UNDER_GENERATION.THRESHOLD
  )) {
    if (run.length < minHours) continue;
    const mean = run.reduce((sum, p) => sum + p.expectedMW, 0) / run.length;
    windows.push({
      start: new Date(run[0].time),
      end: new Date(run[run.length - 1].time),
      type: 'under_generation',
      magnitudePct: Number(pctOfCapacity(mean, capacity).toFixed(1)),
      detail:
        `Forecast averages ${mean.toFixed(1)} MW (${pctOfCapacity(mean, capacity).toFixed(0)}% of ` +
        `nameplate) for ${run.length} hours${isSolar ? ' across the peak-sun window' : ''}.`,
    });
  }

  // ── Operational: what the plant's own sensors are reporting lately ───────
  const readingTimes = telemetry.map((t) => new Date(t?.timestamp).getTime()).filter((t) => !Number.isNaN(t));
  const newestReading = readingTimes.length ? Math.max(...readingTimes) : null;
  const since = newestReading === null ? null : newestReading - OPERATIONAL_LOOKBACK_HOURS * 3600 * 1000;

  const recent = since === null ? [] : telemetry.filter((t) => new Date(t?.timestamp).getTime() >= since);
  const faulty = recent.filter((t) => t?.outage || (t?.sensorStatus && t.sensorStatus !== 'ok'));

  if (faulty.length) {
    const hasOutage = faulty.some((t) => t.outage);
    const times = faulty.map((t) => new Date(t.timestamp).getTime());
    windows.push({
      start: new Date(Math.min(...times)),
      end: new Date(Math.max(...times)),
      type: 'operational_risk',
      hasOutage,
      magnitudePct: Number(((faulty.length / Math.max(recent.length, 1)) * 100).toFixed(1)),
      detail: hasOutage
        ? `${faulty.length} of the last ${recent.length} readings record an outage.`
        : `${faulty.length} of the last ${recent.length} readings came from a degraded sensor.`,
    });
  }

  return windows.map((w) => ({ ...w, severity: severityForRisk(w) }));
}

/**
 * Grade a risk window by how far it actually goes past its threshold, so the
 * severity filters in the console mean something.
 *
 * @param {{type: string, magnitudePct?: number}} riskWindow
 * @returns {'low'|'medium'|'high'}
 */
function severityForRisk(riskWindow) {
  const magnitude = typeof riskWindow?.magnitudePct === 'number' ? riskWindow.magnitudePct : null;

  switch (riskWindow?.type) {
    case 'over_generation':
      // At or past nameplate there is nowhere for the power to go.
      if (magnitude === null) return 'medium';
      return magnitude >= 100 ? 'high' : 'medium';

    case 'under_generation':
      if (magnitude === null) return 'medium';
      if (magnitude < 5) return 'high';
      return magnitude < 12 ? 'medium' : 'low';

    case 'operational_risk':
      // A recorded outage is a high-severity fact however rare it is in the window.
      if (riskWindow.hasOutage) return 'high';
      if (magnitude === null) return 'medium';
      return magnitude >= 25 ? 'high' : 'medium';

    default:
      return 'low';
  }
}

/** Alert type per risk window — the operator-facing name for the condition. */
const ALERT_TYPE_BY_RISK = {
  over_generation: 'curtailment_risk',
  under_generation: 'shortfall_risk',
  operational_risk: 'sensor_fault',
};

module.exports = {
  detectRiskWindows,
  severityForRisk,
  ALERT_TYPE_BY_RISK,
  OVER_GENERATION,
  UNDER_GENERATION,
  OPERATIONAL_LOOKBACK_HOURS,
};
