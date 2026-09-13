'use strict';
const axios = require('axios');
const env = require('../../config/env');
const logger = require('../../utils/logger');

const DEFAULT_BASE_URL = 'https://api.open-meteo.com/v1/forecast';
const MAX_RETRIES = 2;

/** Variables worth asking for, per plant type. */
const HOURLY_VARS = {
  solar:
    'cloud_cover,shortwave_radiation,direct_normal_irradiance,diffuse_radiation,' +
    'precipitation_probability,temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m',
  wind:
    'wind_speed_10m,wind_direction_10m,wind_gusts_10m,wind_speed_80m,wind_direction_80m,' +
    'cloud_cover,precipitation_probability,temperature_2m,relative_humidity_2m,surface_pressure',
};

/**
 * `timezone: 'UTC'` rather than 'auto': with 'auto' Open-Meteo returns
 * timezone-naive local strings ("2026-09-13T00:00"), which `new Date()`
 * resolves against the *server's* zone — correct on an IST machine, silently
 * 5.5 hours out on a UTC host.
 */
const BASE_PARAMS = { timezone: 'UTC' };

/** Open-Meteo omits the zone designator even when asked for UTC — add it back. */
function parseUtc(value) {
  if (value instanceof Date) return value;
  const s = String(value);
  return new Date(/[Zz]|[+-]\d{2}:?\d{2}$/.test(s) ? s : `${s}Z`);
}

/** Top of the current hour, UTC — the line between observed and forecast. */
function currentHour() {
  const d = new Date();
  d.setUTCMinutes(0, 0, 0);
  return d;
}

async function request(params) {
  const baseUrl = env.OPEN_METEO_BASE_URL || DEFAULT_BASE_URL;
  const delay = ms => (process.env.NODE_ENV === 'test' ? Promise.resolve() : new Promise(r => setTimeout(r, ms)));

  let attempt = 0;
  while (attempt <= MAX_RETRIES) {
    try {
      const { data } = await axios.get(baseUrl, { params, timeout: 15000 });
      return data;
    } catch (err) {
      attempt++;
      if (attempt > MAX_RETRIES) throw err;
      logger.warn(`[OpenMeteo] Retry ${attempt}/${MAX_RETRIES} after error: ${err.message}`);
      await delay(500 * attempt);
    }
  }
}

/** Map one index of Open-Meteo's column-wise response into our hourly shape. */
function mapHour(h, i, plantType) {
  // Open-Meteo returns wind speed in km/h — convert to m/s
  const wind10Kmh = h.wind_speed_10m?.[i];
  const wind80Kmh = h.wind_speed_80m?.[i];
  const gustKmh   = h.wind_gusts_10m?.[i];

  // For wind turbines, prefer 80m hub height speed if requested and available
  const preferredWindKmh = (plantType === 'wind' && wind80Kmh != null) ? wind80Kmh : wind10Kmh;

  // Gust over mean speed is the cheapest usable turbulence proxy, and the
  // performance service already reasons about it.
  const turbulence =
    gustKmh != null && preferredWindKmh > 0
      ? Number(Math.max(0, (gustKmh - preferredWindKmh) / preferredWindKmh).toFixed(3))
      : null;

  return {
    time:               parseUtc(h.time[i]),
    cloudCoverPct:      h.cloud_cover?.[i]                ?? null,
    ghiWm2:             h.shortwave_radiation?.[i]        ?? null,
    dniWm2:             h.direct_normal_irradiance?.[i]   ?? null,
    rainProbabilityPct: h.precipitation_probability?.[i]  ?? null,
    temperatureC:       h.temperature_2m?.[i]             ?? null,
    humidityPct:        h.relative_humidity_2m?.[i]       ?? null,
    windSpeedMs:        preferredWindKmh != null ? preferredWindKmh / 3.6 : null,
    windDirectionDeg:   (plantType === 'wind' && h.wind_direction_80m?.[i] != null)
                          ? h.wind_direction_80m[i]
                          : (h.wind_direction_10m?.[i] ?? null),
    windGustMs:         gustKmh != null ? gustKmh / 3.6 : null,
    turbulenceIndex:    turbulence,
  };
}

/**
 * Normalise a raw Open-Meteo response to FluxCast's WeatherSnapshot hourly
 * shape, keeping the forecast window: the current hour onward.
 *
 * @param {object} raw - Raw Open-Meteo API response
 * @param {number} hours - Max hours to return
 * @param {'solar'|'wind'} plantType
 * @returns {Array<object>}
 */
function normaliseOpenMeteo(raw, hours, plantType = 'solar') {
  const h = raw?.hourly;
  if (!h || !Array.isArray(h.time)) return [];

  // Hours already past are noise in a forecast: start at the current hour.
  const from = currentHour().getTime();
  let start = h.time.findIndex(t => parseUtc(t).getTime() >= from);
  if (start < 0) start = 0;

  const count = Math.min(hours, h.time.length - start);
  return Array.from({ length: count }, (_, n) => mapHour(h, start + n, plantType));
}

/**
 * The mirror image: everything strictly before the current hour.
 *
 * @param {object} raw - Raw Open-Meteo API response
 * @param {'solar'|'wind'} plantType
 * @returns {Array<object>}
 */
function normaliseObserved(raw, plantType = 'solar') {
  const h = raw?.hourly;
  if (!h || !Array.isArray(h.time)) return [];

  const until = currentHour().getTime();
  const rows = [];
  for (let i = 0; i < h.time.length; i++) {
    if (parseUtc(h.time[i]).getTime() >= until) break;
    rows.push(mapHour(h, i, plantType));
  }
  return rows;
}

/**
 * Fetch the hourly weather forecast for a location.
 * URL: https://api.open-meteo.com/v1/forecast
 *
 * The response always starts at midnight of the first day, so a horizon of N
 * hours needs an extra day of headroom — everything before the current hour is
 * dropped, so "24h" means the next 24 hours, not "today".
 *
 * @param {number} latitude - Plant latitude (-90 to 90)
 * @param {number} longitude - Plant longitude (-180 to 180)
 * @param {number} [hours=72] - Forecast horizon in hours (max 72)
 * @param {'solar'|'wind'} [plantType='solar'] - Determines variables to request
 * @returns {Promise<Array<object>>} Normalised hourly weather array
 */
async function fetchOpenMeteoWeather(latitude, longitude, hours = 72, plantType = 'solar') {
  const data = await request({
    ...BASE_PARAMS,
    latitude,
    longitude,
    hourly: HOURLY_VARS[plantType] || HOURLY_VARS.solar,
    forecast_days: Math.max(1, Math.min(Math.ceil((hours + 24) / 24), 16)),
  });
  return normaliseOpenMeteo(data, hours, plantType);
}

/**
 * Fetch weather for hours that have already happened.
 *
 * Open-Meteo serves its own recorded analysis for past days from the same
 * endpoint, which is what makes it possible to say what the conditions
 * actually were over a stretch of stored telemetry — the pairing the
 * generation model calibrates on.
 *
 * @param {number} latitude
 * @param {number} longitude
 * @param {number} [days=14] - How far back to reach (Open-Meteo allows 92)
 * @param {'solar'|'wind'} [plantType='solar']
 * @returns {Promise<Array<object>>} Hourly weather, oldest first, ending before the current hour
 */
async function fetchObservedWeather(latitude, longitude, days = 14, plantType = 'solar') {
  const data = await request({
    ...BASE_PARAMS,
    latitude,
    longitude,
    hourly: HOURLY_VARS[plantType] || HOURLY_VARS.solar,
    past_days: Math.max(1, Math.min(days, 92)),
    forecast_days: 1,
  });
  return normaliseObserved(data, plantType);
}

module.exports = {
  fetchOpenMeteoWeather,
  fetchObservedWeather,
  normaliseOpenMeteo,
  normaliseObserved,
  parseUtc,
  HOURLY_VARS,
  DEFAULT_BASE_URL,
};
