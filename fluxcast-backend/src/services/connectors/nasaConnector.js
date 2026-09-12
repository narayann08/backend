'use strict';
const axios = require('axios');
const env = require('../../config/env');
const logger = require('../../utils/logger');

const MAX_RETRIES = 2;

// NASA POWER RE (Renewable Energy) parameter profiles (max 15 allowed per request)
const SOLAR_PARAMETERS = 'ALLSKY_SFC_SW_DWN,CLRSKY_SFC_SW_DWN,T2M,RH2M,WS10M,WD10M,CLOUD_AMT,PRECTOTCORR';
const WIND_PARAMETERS  = 'WS10M,WD10M,WS50M,T2M,RH2M,PS,CLOUD_AMT';

// NASA POWER sentinel fill value indicating missing or invalid observation
const SENTINEL_THRESHOLD = -900;

/**
 * Normalise a single parameter value from NASA POWER.
 * Maps values <= -900 (such as -999, -999.0) and non-numeric values to null.
 *
 * @param {number|null|undefined} val
 * @returns {number|null}
 */
function cleanValue(val) {
  if (val === null || val === undefined || isNaN(val) || val <= SENTINEL_THRESHOLD) {
    return null;
  }
  return val;
}

/**
 * Fetch NASA POWER satellite-derived hourly meteorological data for a given location.
 * Uses the NASA POWER API (/temporal/hourly/point) with the Renewable Energy (RE) community.
 *
 * Documentation: https://power.larc.nasa.gov/docs/services/api/
 *
 * @param {number} latitude - Plant latitude (-90 to 90)
 * @param {number} longitude - Plant longitude (-180 to 180)
 * @param {number} [hours=72] - Forecast horizon in hours
 * @param {'solar'|'wind'} [plantType='solar'] - Renewable plant type
 * @returns {Promise<Array<object>|null>} Normalised hourly data or null if unavailable
 */
async function fetchNasaWeather(latitude, longitude, hours = 72, plantType = 'solar') {
  const baseUrl = (env.NASA_POWER_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');
  const endpoint = baseUrl.endsWith('/point') || baseUrl.includes('/api/weather')
    ? baseUrl
    : `${baseUrl}/temporal/hourly/point`;

  const parameters = plantType === 'wind' ? WIND_PARAMETERS : SOLAR_PARAMETERS;

  // Compute start and end dates (format: YYYYMMDD)
  const startDate = new Date();
  const endDate = new Date(startDate.getTime() + Math.max(hours, 24) * 3600 * 1000);
  const formatDate = d => d.toISOString().slice(0, 10).replace(/-/g, '');

  const params = {
    parameters,
    community: 'RE',
    longitude,
    latitude,
    start: formatDate(startDate),
    end: formatDate(endDate),
    format: 'JSON',
    'time-standard': 'UTC',
    header: 'FALSE',
  };

  const delay = ms => (process.env.NODE_ENV === 'test' ? Promise.resolve() : new Promise(r => setTimeout(r, ms)));

  let attempt = 0;
  while (attempt <= MAX_RETRIES) {
    try {
      const response = await axios.get(endpoint, {
        params,
        timeout: 20000,
        validateStatus: status => status < 500, // Handle 4xx explicitly below
      });

      const status = response.status || 200;
      const data = response.data || {};

      if (status === 200) {
        const normalised = normaliseNasaPower(data, hours, plantType);
        if (!normalised || normalised.length === 0) {
          logger.info('[NASA POWER] Query succeeded but no data points in range (likely future horizon) — falling back');
          return null;
        }
        return normalised;
      }

      // Handle 422 Unprocessable Entity (e.g. date out of range, parameter mismatch)
      if (status === 422) {
        const messages = data.messages || data.detail || data.header;
        logger.warn(`[NASA POWER] Validation error 422: ${JSON.stringify(messages)} — falling back gracefully`);
        return null;
      }

      // Handle 429 Rate Limiting
      if (status === 429) {
        logger.warn('[NASA POWER] Rate limit exceeded (429) — backing off');
        attempt++;
        if (attempt > MAX_RETRIES) return null;
        await delay(1000 * attempt);
        continue;
      }

      // Other 4xx responses
      logger.warn(`[NASA POWER] HTTP ${status}: ${JSON.stringify(data)}`);
      return null;
    } catch (err) {
      attempt++;
      if (attempt > MAX_RETRIES) {
        logger.warn(`[NASA POWER] Persistent connection failure: ${err.message} — falling back to other sources`);
        return null;
      }
      logger.warn(`[NASA POWER] Retry ${attempt}/${MAX_RETRIES} after error: ${err.message}`);
      await delay(500 * attempt);
    }
  }

  return null;
}

/**
 * Normalise NASA POWER API response to FluxCast's standard hourly WeatherSnapshot shape.
 *
 * @param {object} raw - NASA POWER JSON response
 * @param {number} hours - Maximum hours to return
 * @param {'solar'|'wind'} plantType
 * @returns {Array<object>} Normalised hourly records
 */
function normaliseNasaPower(raw, hours, plantType = 'solar') {
  try {
    // Direct support for FastAPI proxy record format (flat array or { records: [...] })
    const recordList = Array.isArray(raw) ? raw : (Array.isArray(raw?.records) ? raw.records : null);
    if (recordList) {
      return recordList.slice(0, hours).map(r => {
        const windSpeed50 = cleanValue(r.WS50M);
        const windSpeed10 = cleanValue(r.WS10M);
        const windSpeedMs = windSpeed50 !== null ? windSpeed50 : windSpeed10;

        return {
          time: new Date(r.time),
          cloudCoverPct:      cleanValue(r.CLOUD_AMT),
          ghiWm2:             cleanValue(r.ALLSKY_SFC_SW_DWN),
          dniWm2:             cleanValue(r.CLRSKY_SFC_SW_DWN),
          rainProbabilityPct: null,
          temperatureC:       cleanValue(r.T2M),
          humidityPct:        cleanValue(r.RH2M),
          windSpeedMs,
          windDirectionDeg:   cleanValue(r.WD10M),
          windGustMs:         null,
          turbulenceIndex:    null,
        };
      });
    }

    const props = raw?.properties?.parameter;
    if (!props) return [];

    // Identify primary time series key based on plant type
    const primaryParam = plantType === 'wind'
      ? (props.WS10M || props.WS50M || props.T2M)
      : (props.ALLSKY_SFC_SW_DWN || props.T2M);

    if (!primaryParam) return [];

    const timeKeys = Object.keys(primaryParam).slice(0, hours);
    if (timeKeys.length === 0) return [];

    return timeKeys.map(timeKey => {
      // NASA POWER time key format: YYYYMMDDHH (e.g. "2024010114")
      const year  = timeKey.slice(0, 4);
      const month = timeKey.slice(4, 6);
      const day   = timeKey.slice(6, 8);
      const hour  = timeKey.slice(8, 10);
      const time  = new Date(`${year}-${month}-${day}T${hour}:00:00Z`);

      // Determine wind speed: prefer 50m hub height if available, fallback to 10m
      const windSpeed50 = cleanValue(props.WS50M?.[timeKey]);
      const windSpeed10 = cleanValue(props.WS10M?.[timeKey]);
      const windSpeedMs = windSpeed50 !== null ? windSpeed50 : windSpeed10;

      return {
        time,
        cloudCoverPct:      cleanValue(props.CLOUD_AMT?.[timeKey]),
        ghiWm2:             cleanValue(props.ALLSKY_SFC_SW_DWN?.[timeKey]),
        dniWm2:             cleanValue(props.CLRSKY_SFC_SW_DWN?.[timeKey]),
        rainProbabilityPct: null, // NASA POWER provides mm/hr (PRECTOTCORR), not probability
        temperatureC:       cleanValue(props.T2M?.[timeKey]),
        humidityPct:        cleanValue(props.RH2M?.[timeKey]),
        windSpeedMs,
        windDirectionDeg:   cleanValue(props.WD10M?.[timeKey]),
        windGustMs:         null,
        turbulenceIndex:    null,
      };
    });
  } catch (err) {
    logger.warn('[NASA POWER] Normalisation error:', err.message);
    return [];
  }
}

module.exports = {
  fetchNasaWeather,
  normaliseNasaPower,
  cleanValue,
  SOLAR_PARAMETERS,
  WIND_PARAMETERS,
};
