'use strict';
const { fetchNasaWeather } = require('../connectors/nasaConnector');

/**
 * MCP Tool: nasaGisTool (NASA POWER API)
 *
 * Fetch supporting NASA satellite-derived meteorological data from the NASA POWER API
 * (temporal/hourly/point) for renewable energy (RE community).
 * Provides solar irradiance (GHI, clear-sky DNI), cloud coverage, temperature,
 * and wind speed (10m and 50m hub height) for cross-checking forecasts.
 */
const nasaGisTool = {
  name: 'nasaGisTool',
  description:
    'Fetch supporting meteorological and solar irradiance data from NASA POWER API ' +
    '(temporal/hourly/point, RE community) for a given coordinate. ' +
    'Use this as an independent satellite validation source for solar irradiance (ALLSKY_SFC_SW_DWN) ' +
    'and wind speeds (WS10M, WS50M). Returns null/empty if unavailable.',
  inputSchema: {
    type: 'object',
    required: ['latitude', 'longitude'],
    properties: {
      latitude:  { type: 'number', description: 'Location latitude (-90 to 90)' },
      longitude: { type: 'number', description: 'Location longitude (-180 to 180)' },
      hours:     { type: 'number', description: 'Forecast horizon in hours (default 72)', default: 72 },
      plantType: { type: 'string', enum: ['solar', 'wind'], description: 'Plant type for tailored met parameters', default: 'solar' },
    },
  },
  /**
   * @param {{ latitude: number, longitude: number, hours?: number, plantType?: string }} input
   */
  async handler(input) {
    const { latitude, longitude, hours = 72, plantType = 'solar' } = input;
    const hourly = await fetchNasaWeather(latitude, longitude, hours, plantType);
    return {
      source: 'nasa-power',
      hourly,
      available: Array.isArray(hourly) && hourly.length > 0,
    };
  },
};

module.exports = nasaGisTool;
