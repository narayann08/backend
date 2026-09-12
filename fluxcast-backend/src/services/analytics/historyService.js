'use strict';
const Telemetry = require('../../models/Telemetry');
const ForecastResult = require('../../models/ForecastResult');

/** Round a timestamp down to the top of its hour, so actuals and forecasts line up. */
function hourKey(date) {
  const d = new Date(date);
  d.setUTCMinutes(0, 0, 0);
  return d.toISOString();
}

/**
 * Build the hourly forecast-vs-actual series for a plant over a date range.
 *
 * For every hour we use the forecast that was *generated before that hour* —
 * i.e. what the model genuinely predicted ahead of time, never a forecast
 * produced after the fact. Where several qualify, the most recent one wins.
 *
 * @param {string} plantId
 * @param {Date} from
 * @param {Date} to
 * @returns {Promise<{points: Array, summary: object}>}
 */
async function buildHistorySeries(plantId, from, to) {
  const [telemetry, forecasts] = await Promise.all([
    Telemetry.find({ plantId, timestamp: { $gte: from, $lte: to } })
      .sort({ timestamp: 1 })
      .lean(),
    ForecastResult.find({ plantId }).sort({ generatedAt: 1 }).lean(),
  ]);

  // ── Actuals: average each hour's readings ────────────────────────────────
  const actualBuckets = new Map();
  for (const reading of telemetry) {
    const key = hourKey(reading.timestamp);
    if (!actualBuckets.has(key)) {
      actualBuckets.set(key, { sum: 0, count: 0, degraded: false, outage: false });
    }
    const bucket = actualBuckets.get(key);
    bucket.sum += reading.generationMW || 0;
    bucket.count += 1;
    if (reading.sensorStatus && reading.sensorStatus !== 'ok') bucket.degraded = true;
    if (reading.outage) bucket.outage = true;
  }

  // ── Forecasts: keep the newest prediction made before each target hour ────
  const forecastBuckets = new Map();
  for (const forecast of forecasts) {
    const generatedAt = new Date(forecast.generatedAt).getTime();
    for (const point of forecast.points || []) {
      const pointTime = new Date(point.time);
      if (pointTime < from || pointTime > to) continue;

      const key = hourKey(pointTime);
      const isAheadOfTime = generatedAt <= pointTime.getTime();
      const existing = forecastBuckets.get(key);

      // Prefer a genuine ahead-of-time prediction; among those, the most recent.
      if (
        !existing ||
        (isAheadOfTime && !existing.isAheadOfTime) ||
        (isAheadOfTime === existing.isAheadOfTime && generatedAt > existing.generatedAt)
      ) {
        forecastBuckets.set(key, { point, generatedAt, isAheadOfTime });
      }
    }
  }

  // ── Merge into one ordered series ────────────────────────────────────────
  const allKeys = [...new Set([...actualBuckets.keys(), ...forecastBuckets.keys()])].sort();

  const points = allKeys.map(key => {
    const actual = actualBuckets.get(key);
    const forecast = forecastBuckets.get(key);
    const actualMW = actual ? Number((actual.sum / actual.count).toFixed(2)) : null;
    const forecastMW =
      forecast && typeof forecast.point.expectedMW === 'number'
        ? Number(forecast.point.expectedMW.toFixed(2))
        : null;

    return {
      time: key,
      actualMW,
      forecastMW,
      lowerBoundMW: forecast?.point?.lowerBoundMW ?? null,
      upperBoundMW: forecast?.point?.upperBoundMW ?? null,
      confidencePct: forecast?.point?.confidencePct ?? null,
      errorMW:
        actualMW !== null && forecastMW !== null
          ? Number((actualMW - forecastMW).toFixed(2))
          : null,
      sensorDegraded: actual ? actual.degraded : null,
      outage: actual ? actual.outage : null,
      forecastGeneratedAt: forecast ? new Date(forecast.generatedAt) : null,
    };
  });

  // ── Accuracy summary over hours where both series exist ──────────────────
  const paired = points.filter(p => p.actualMW !== null && p.forecastMW !== null);
  const absErrors = paired.map(p => Math.abs(p.actualMW - p.forecastMW));
  const maeMW = absErrors.length
    ? Number((absErrors.reduce((s, e) => s + e, 0) / absErrors.length).toFixed(2))
    : null;

  // MAPE is only meaningful where the actual is materially non-zero.
  const mapeBasis = paired.filter(p => Math.abs(p.actualMW) >= 1);
  const mapePct = mapeBasis.length
    ? Number(
        (
          (mapeBasis.reduce((s, p) => s + Math.abs((p.actualMW - p.forecastMW) / p.actualMW), 0) /
            mapeBasis.length) *
          100
        ).toFixed(1)
      )
    : null;

  const confidences = points.map(p => p.confidencePct).filter(c => typeof c === 'number');
  const actualsOnly = points.map(p => p.actualMW).filter(v => typeof v === 'number');
  const forecastsOnly = points.map(p => p.forecastMW).filter(v => typeof v === 'number');

  return {
    points,
    summary: {
      hours: points.length,
      pairedHours: paired.length,
      actualTotalMWh: actualsOnly.length
        ? Number(actualsOnly.reduce((s, v) => s + v, 0).toFixed(1))
        : null,
      forecastTotalMWh: forecastsOnly.length
        ? Number(forecastsOnly.reduce((s, v) => s + v, 0).toFixed(1))
        : null,
      peakActualMW: actualsOnly.length ? Math.max(...actualsOnly) : null,
      maeMW,
      mapePct,
      avgConfidencePct: confidences.length
        ? Number((confidences.reduce((s, c) => s + c, 0) / confidences.length).toFixed(1))
        : null,
    },
  };
}

module.exports = { buildHistorySeries };
