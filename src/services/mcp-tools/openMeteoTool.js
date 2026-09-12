'use strict';
const { fetchOpenMeteoWeather } = require('../connectors/openMeteoConnector');

/**
 * MCP Tool: openMeteoTool
 *
 * Fetch hourly weather forecast (cloud cover, solar radiation, wind speed/direction,
 * rain probability, temperature) for a given latitude/longitude and horizon in hours.
 * Use this as the primary weather data source — it is always available without an API key.
 */
const openMeteoTool = {
  name: 'openMeteoTool',
  description:
    'Fetch hourly weather forecast (cloud cover, solar radiation, wind speed/direction, ' +
    'rain probability, temperature) for a given latitude/longitude and horizon in hours. ' +
    'Use this as the primary weather data source — it is always available without an API key.',
  inputSchema: {
    type: 'object',
    required: ['latitude', 'longitude'],
    properties: {
      latitude:  { type: 'number', description: 'Location latitude' },
      longitude: { type: 'number', description: 'Location longitude' },
      hours:     { type: 'number', description: 'Forecast horizon in hours (default 72, max 72)', default: 72 },
      plantType: { type: 'string', enum: ['solar', 'wind'], description: 'Plant type — determines which weather variables to fetch', default: 'solar' },
    },
  },
  /**
   * @param {{ latitude: number, longitude: number, hours?: number, plantType?: string }} input
   */
  async handler(input) {
    const { latitude, longitude, hours = 72, plantType = 'solar' } = input;
    const hourly = await fetchOpenMeteoWeather(latitude, longitude, hours, plantType);
    return { source: 'open-meteo', hourly };
  },
};

module.exports = openMeteoTool;
