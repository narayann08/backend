'use strict';
const axios = require('axios');
jest.mock('axios');

process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
process.env.JWT_SECRET  = 'test';
process.env.NODE_ENV    = 'test';

const { fetchOpenMeteoWeather } = require('../../src/services/connectors/openMeteoConnector');

const mockResponse = {
  data: {
    hourly: {
      time:                       Array.from({ length: 72 }, (_, i) => new Date(Date.now() + i * 3600000).toISOString()),
      cloud_cover:                Array(72).fill(30),
      shortwave_radiation:        Array(72).fill(500),
      direct_normal_irradiance:   Array(72).fill(400),
      precipitation_probability:  Array(72).fill(10),
      temperature_2m:             Array(72).fill(28),
      relative_humidity_2m:       Array(72).fill(60),
      wind_speed_10m:             Array(72).fill(18), // 18 km/h → 5 m/s
      wind_direction_10m:         Array(72).fill(180),
    },
  },
};

describe('openMeteoConnector', () => {
  beforeEach(() => jest.clearAllMocks());

  it('fetches and normalises solar weather data (24h)', async () => {
    axios.get.mockResolvedValue(mockResponse);
    const result = await fetchOpenMeteoWeather(22.5, 70.1, 24, 'solar');
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(24);
    expect(result[0]).toHaveProperty('cloudCoverPct', 30);
    expect(result[0]).toHaveProperty('ghiWm2', 500);
    expect(result[0].windSpeedMs).toBeCloseTo(5, 0); // 18 km/h → 5 m/s
  });

  it('returns correct number of points', async () => {
    axios.get.mockResolvedValue(mockResponse);
    const result = await fetchOpenMeteoWeather(22.5, 70.1, 48, 'wind');
    expect(result.length).toBe(48);
  });

  it('retries 2 times then throws on persistent failure', async () => {
    axios.get.mockRejectedValue(new Error('Network error'));
    await expect(fetchOpenMeteoWeather(22.5, 70.1, 24, 'solar')).rejects.toThrow('Network error');
    // initial attempt + 2 retries = 3 total calls
    expect(axios.get).toHaveBeenCalledTimes(3);
  });

  it('normalises null fields when optional variables absent', async () => {
    const sparseResponse = {
      data: {
        hourly: {
          time:        mockResponse.data.hourly.time,
          cloud_cover: Array(72).fill(50),
          // all other fields absent
        },
      },
    };
    axios.get.mockResolvedValue(sparseResponse);
    const result = await fetchOpenMeteoWeather(22.5, 70.1, 2, 'solar');
    expect(result[0].ghiWm2).toBeNull();
    expect(result[0].cloudCoverPct).toBe(50);
  });
});
