'use strict';
const axios = require('axios');
const env = require('../../config/env');
const logger = require('../../utils/logger');

const DEFAULT_BASE_URL = 'https://api.open-meteo.com/v1/forecast';
const MAX_RETRIES = 2;

/**
 * Fetch hourly weather forecast from Open-Meteo for a given location.
 * URL: https://api.open-meteo.com/v1/forecast
 *
 * @param {number} latitude - Plant latitude (-90 to 90)
 * @param {number} longitude - Plant longitude (-180 to 180)
 * @param {number} [hours=72] - Forecast horizon in hours (max 72)
 * @param {'solar'|'wind'} [plantType='solar'] - Determines variables to request
 * @returns {Promise<Array<object>>} Normalised hourly weather array
 */
async function fetchOpenMeteoWeather(latitude, longitude, hours = 72, plantType = 'solar') {
  const baseUrl = env.OPEN_METEO_BASE_URL || DEFAULT_BASE_URL;

  const hourlyVars = plantType === 'solar'
    ? 'cloud_cover,shortwave_radiation,direct_normal_irradiance,diffuse_radiation,precipitation_probability,temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m'
    : 'wind_speed_10m,wind_direction_10m,wind_gusts_10m,wind_speed_80m,wind_direction_80m,cloud_cover,precipitation_probability,temperature_2m,relative_humidity_2m,surface_pressure';

  const params = {
    latitude,
    longitude,
    hourly: hourlyVars,
    forecast_days: Math.max(1, Math.min(Math.ceil(hours / 24), 16)),
    timezone: 'auto',
  };

  const delay = ms => (process.env.NODE_ENV === 'test' ? Promise.resolve() : new Promise(r => setTimeout(r, ms)));

  let attempt = 0;
  while (attempt <= MAX_RETRIES) {
    try {
      const { data } = await axios.get(baseUrl, { params, timeout: 15000 });
      return normaliseOpenMeteo(data, hours, plantType);
    } catch (err) {
      attempt++;
      if (attempt > MAX_RETRIES) throw err;
      logger.warn(`[OpenMeteo] Retry ${attempt}/${MAX_RETRIES} after error: ${err.message}`);
      await delay(500 * attempt);
    }
  }
}

/**
 * Normalise raw Open-Meteo response to FluxCast's WeatherSnapshot hourly shape.
 *
 * @param {object} raw - Raw Open-Meteo API response
 * @param {number} hours - Max hours to return
 * @param {'solar'|'wind'} plantType
 * @returns {Array<object>}
 */
function normaliseOpenMeteo(raw, hours, plantType = 'solar') {
  const h = raw?.hourly;
  if (!h || !Array.isArray(h.time)) return [];

  const count = Math.min(hours, h.time.length);
  const result = [];

  for (let i = 0; i < count; i++) {
    // Open-Meteo returns wind speed in km/h — convert to m/s
    const wind10Kmh = h.wind_speed_10m?.[i];
    const wind80Kmh = h.wind_speed_80m?.[i];
    const gustKmh   = h.wind_gusts_10m?.[i];

    // For wind turbines, prefer 80m hub height speed if requested and available
    const preferredWindKmh = (plantType === 'wind' && wind80Kmh != null) ? wind80Kmh : wind10Kmh;

    result.push({
      time:               new Date(h.time[i]),
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
      turbulenceIndex:    null,
    });
  }
  return result;
}

module.exports = {
  fetchOpenMeteoWeather,
  normaliseOpenMeteo,
  DEFAULT_BASE_URL,
};
