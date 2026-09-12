'use strict';
/**
 * MOSDAC Connector — Removed and Replaced with Open-Meteo API Forecast
 * (https://api.open-meteo.com/v1/forecast)
 */
const { fetchOpenMeteoWeather, normaliseOpenMeteo } = require('./openMeteoConnector');

/**
 * Replaces legacy MOSDAC fetch with Open-Meteo API forecast.
 *
 * @param {number} latitude
 * @param {number} longitude
 * @param {number} [hours=72]
 * @param {'solar'|'wind'} [plantType='solar']
 * @returns {Promise<Array<object>|null>}
 */
async function fetchMosdacWeather(latitude, longitude, hours = 72, plantType = 'solar') {
  try {
    return await fetchOpenMeteoWeather(latitude, longitude, hours, plantType);
  } catch (err) {
    return null;
  }
}

module.exports = {
  fetchMosdacWeather,
  normaliseMosdac: normaliseOpenMeteo,
};
