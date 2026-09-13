'use strict';
const { impliedMW, hourKey } = require('../forecast/generationModel');
const { istHourOfDay } = require('../../utils/istTime');

/**
 * The stand-in SCADA feed.
 *
 * FluxCast has no live plant integration, so measured output is manufactured.
 * It used to be a bare sine curve over the hour of day, which made forecast
 * accuracy meaningless to measure: the forecast tracked real weather while the
 * "actuals" tracked a clock, so the two could never agree and the error was
 * whatever the weather happened to be doing that day.
 *
 * Readings are now derived from the same weather the forecaster sees, scaled
 * by a per-plant efficiency and roughened with noise. A good forecast can
 * therefore be *right*, and the error the history page reports is a real
 * measure of the model rather than an artefact of two unrelated generators.
 *
 * The clock-based curve survives as a fallback for hours with no stored
 * weather — seeding a fresh database, mostly.
 */

/** Standing site efficiency: wiring, soiling, availability. Stable per plant. */
const SITE_EFFICIENCY = { solar: 0.82, wind: 0.78 };

/** Hour-to-hour roughness, as a fraction of the weather-implied figure. */
const NOISE_PCT = 0.06;

/** Chance any given reading comes from a degraded sensor. */
const DEGRADED_RATE = 0.03;

/** Deterministic per-plant jitter, so two plants in the same weather differ. */
function plantSeed(plantId) {
  const s = String(plantId);
  let hash = 0;
  for (let i = 0; i < s.length; i += 1) hash = (hash * 31 + s.charCodeAt(i)) % 1000;
  return hash / 1000;
}

/** Clock-driven curve — only for hours with no weather on record. */
function curveFallbackMW(plant, timestamp) {
  const hourOfDay = istHourOfDay(timestamp);

  if (plant.type === 'solar') {
    if (hourOfDay < 6 || hourOfDay > 18) return 0;
    const peak = Math.sin(((hourOfDay - 6) / 12) * Math.PI);
    return Math.max(0, plant.capacityMW * 0.85 * peak);
  }

  const windFactor = 0.4 + 0.3 * Math.cos((hourOfDay / 24) * 2 * Math.PI);
  return Math.max(0, Math.min(plant.capacityMW, plant.capacityMW * windFactor));
}

/**
 * Index weather hours for lookup by hour.
 * @param {Array<object>} hourly
 * @returns {Map<string, object>}
 */
function indexWeather(hourly = []) {
  const byHour = new Map();
  for (const hour of hourly) {
    if (hour?.time) byHour.set(hourKey(hour.time), hour);
  }
  return byHour;
}

const HOUR_MS = 3600 * 1000;

/** Numeric fields worth blending between two hours. */
const INTERPOLATED = ['ghiWm2', 'dniWm2', 'temperatureC', 'windSpeedMs', 'cloudCoverPct', 'humidityPct'];

/**
 * Weather for an instant between two hourly entries.
 *
 * Readings land every 15 minutes but weather arrives hourly, so four readings
 * an hour would otherwise share one set of conditions and the generation curve
 * would climb in steps. Blending toward the next hour keeps it a curve.
 */
function weatherAt(timestamp, weatherByHour) {
  if (!weatherByHour?.size) return null;

  const current = weatherByHour.get(hourKey(timestamp));
  if (!current) return null;

  const next = weatherByHour.get(hourKey(new Date(new Date(timestamp).getTime() + HOUR_MS)));
  if (!next) return current;

  const position = (new Date(timestamp).getTime() % HOUR_MS) / HOUR_MS;
  if (position === 0) return current;

  const blended = { ...current };
  for (const field of INTERPOLATED) {
    const from = current[field];
    const to = next[field];
    if (typeof from === 'number' && typeof to === 'number') {
      blended[field] = from + (to - from) * position;
    }
  }
  return blended;
}

/**
 * One mock reading for a plant at an instant.
 *
 * @param {object} plant
 * @param {Date} timestamp
 * @param {Map<string, object>} [weatherByHour] - From {@link indexWeather}
 * @returns {{plantId: any, timestamp: Date, generationMW: number, sensorStatus: string, outage: boolean}}
 */
function buildReading(plant, timestamp, weatherByHour) {
  const weatherHour = weatherAt(timestamp, weatherByHour);
  const implied = weatherHour ? impliedMW(plant, weatherHour) : null;

  const efficiency = SITE_EFFICIENCY[plant.type] ?? 0.8;
  const jitter = 0.92 + plantSeed(plant._id) * 0.16; // ±8% between sites

  const base = implied !== null ? implied * efficiency * jitter : curveFallbackMW(plant, timestamp) * jitter;
  const noise = 1 + (Math.random() * 2 - 1) * NOISE_PCT;
  const generationMW = Math.max(0, Math.min(plant.capacityMW, base * noise));

  const degraded = Math.random() < DEGRADED_RATE;

  return {
    plantId: plant._id,
    timestamp: new Date(timestamp),
    generationMW: Math.round(generationMW * 10) / 10,
    sensorStatus: degraded ? 'degraded' : 'ok',
    outage: false,
  };
}

module.exports = {
  buildReading,
  indexWeather,
  weatherAt,
  curveFallbackMW,
  SITE_EFFICIENCY,
};
