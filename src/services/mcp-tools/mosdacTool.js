'use strict';
const { fetchOpenMeteoWeather } = require('../connectors/openMeteoConnector');

/**
 * MCP Tool: mosdacTool (Replaced with Open-Meteo API Forecast)
 *
 * Formerly ISRO MOSDAC, now powered by Open-Meteo API (https://api.open-meteo.com/v1/forecast).
 */
const mosdacTool = {
  name: 'openMeteoForecastTool',
  description:
    'Fetch numerical weather forecast data from Open-Meteo API ' +
    '(https://api.open-meteo.com/v1/forecast) for a location. ' +
    'Returns hourly GHI, DNI, cloud cover, temperature, and wind speed.',
  inputSchema: {
    type: 'object',
    required: ['latitude', 'longitude'],
    properties: {
      latitude:  { type: 'number' },
      longitude: { type: 'number' },
      hours:     { type: 'number', default: 72 },
      plantType: { type: 'string', enum: ['solar', 'wind'], default: 'solar' },
    },
  },
  /**
   * @param {{ latitude: number, longitude: number, hours?: number, plantType?: string }} input
   */
  async handler(input) {
    const { latitude, longitude, hours = 72, plantType = 'solar' } = input;
    try {
      const hourly = await fetchOpenMeteoWeather(latitude, longitude, hours, plantType);
      return { source: 'open-meteo', hourly, available: Array.isArray(hourly) && hourly.length > 0 };
    } catch (err) {
      return { source: 'open-meteo', hourly: null, available: false };
    }
  },
};

module.exports = mosdacTool;
