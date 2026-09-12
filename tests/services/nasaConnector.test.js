'use strict';
const axios = require('axios');
jest.mock('axios');

process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
process.env.JWT_SECRET  = 'test';
process.env.NODE_ENV    = 'test';
process.env.NASA_POWER_BASE_URL = 'https://power.larc.nasa.gov/api/';

const {
  fetchNasaWeather,
  normaliseNasaPower,
  cleanValue,
  SOLAR_PARAMETERS,
  WIND_PARAMETERS,
} = require('../../src/services/connectors/nasaConnector');

const mockSolarData = {
  properties: {
    parameter: {
      ALLSKY_SFC_SW_DWN: {
        '2024010100': 0.0,
        '2024010106': 150.5,
        '2024010112': 780.2,
      },
      CLRSKY_SFC_SW_DWN: {
        '2024010100': 0.0,
        '2024010106': 160.0,
        '2024010112': 800.0,
      },
      CLOUD_AMT: {
        '2024010100': 20.0,
        '2024010106': -999.0, // Sentinel value for missing data
        '2024010112': 10.5,
      },
      T2M: {
        '2024010100': 15.2,
        '2024010106': 18.0,
        '2024010112': 28.5,
      },
      RH2M: {
        '2024010100': 65.0,
        '2024010106': 55.0,
        '2024010112': 35.0,
      },
      WS10M: {
        '2024010100': 3.2,
        '2024010106': 4.1,
        '2024010112': 5.0,
      },
      WD10M: {
        '2024010100': 120.0,
        '2024010106': 135.0,
        '2024010112': 180.0,
      },
    },
  },
};

const mockWindData = {
  properties: {
    parameter: {
      WS10M: {
        '2024010100': 5.0,
        '2024010101': 5.5,
      },
      WS50M: {
        '2024010100': 8.2, // Hub height speed
        '2024010101': 8.8,
      },
      WD10M: {
        '2024010100': 220.0,
        '2024010101': 230.0,
      },
      T2M: {
        '2024010100': 22.0,
        '2024010101': 21.5,
      },
      RH2M: {
        '2024010100': 70.0,
        '2024010101': 72.0,
      },
      CLOUD_AMT: {
        '2024010100': 40.0,
        '2024010101': 45.0,
      },
    },
  },
};

describe('NASA POWER Connector', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('cleanValue helper', () => {
    it('returns null for sentinel -999, -999.0, and values <= -900', () => {
      expect(cleanValue(-999)).toBeNull();
      expect(cleanValue(-999.0)).toBeNull();
      expect(cleanValue(-900)).toBeNull();
      expect(cleanValue(-1000)).toBeNull();
    });

    it('returns null for undefined, null, and NaN', () => {
      expect(cleanValue(undefined)).toBeNull();
      expect(cleanValue(null)).toBeNull();
      expect(cleanValue(NaN)).toBeNull();
    });

    it('preserves valid numbers, including zero and positive values', () => {
      expect(cleanValue(0)).toBe(0);
      expect(cleanValue(150.5)).toBe(150.5);
      expect(cleanValue(-5)).toBe(-5); // Valid temperature below freezing
    });
  });

  describe('fetchNasaWeather - Solar', () => {
    it('queries NASA POWER API temporal/hourly/point with solar parameters', async () => {
      axios.get.mockResolvedValue({
        status: 200,
        data: mockSolarData,
      });

      const result = await fetchNasaWeather(27.53, 71.91, 3, 'solar');

      expect(axios.get).toHaveBeenCalledWith(
        'https://power.larc.nasa.gov/api/temporal/hourly/point',
        expect.objectContaining({
          params: expect.objectContaining({
            parameters: SOLAR_PARAMETERS,
            community: 'RE',
            longitude: 71.91,
            latitude: 27.53,
            format: 'JSON',
            'time-standard': 'UTC',
          }),
        })
      );

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(3);

      // Check midday solar data point
      const noon = result[2];
      expect(noon.ghiWm2).toBe(780.2);
      expect(noon.dniWm2).toBe(800.0);
      expect(noon.cloudCoverPct).toBe(10.5);
      expect(noon.temperatureC).toBe(28.5);

      // Check sentinel cleanup on point 1 (06:00 has cloud_amt = -999)
      expect(result[1].cloudCoverPct).toBeNull();
    });
  });

  describe('fetchNasaWeather - Wind', () => {
    it('queries NASA POWER API with wind parameters and prefers 50m hub height', async () => {
      axios.get.mockResolvedValue({
        status: 200,
        data: mockWindData,
      });

      const result = await fetchNasaWeather(8.25, 77.54, 2, 'wind');

      expect(axios.get).toHaveBeenCalledWith(
        'https://power.larc.nasa.gov/api/temporal/hourly/point',
        expect.objectContaining({
          params: expect.objectContaining({
            parameters: WIND_PARAMETERS,
            community: 'RE',
          }),
        })
      );

      expect(result.length).toBe(2);
      expect(result[0].windSpeedMs).toBe(8.2); // Uses WS50M
      expect(result[0].windDirectionDeg).toBe(220.0);
    });
  });

  describe('Error & Edge Case Handling', () => {
    it('handles 422 Unprocessable Entity gracefully and returns null', async () => {
      axios.get.mockResolvedValue({
        status: 422,
        data: {
          header: 'The POWER Hourly API failed',
          messages: ['One of your parameters is incorrect.'],
        },
      });

      const result = await fetchNasaWeather(27.53, 71.91, 24, 'solar');
      expect(result).toBeNull();
    });

    it('handles empty parameter response (e.g. future horizon) by returning null', async () => {
      axios.get.mockResolvedValue({
        status: 200,
        data: {
          properties: {
            parameter: {
              ALLSKY_SFC_SW_DWN: {},
            },
          },
        },
      });

      const result = await fetchNasaWeather(27.53, 71.91, 24, 'solar');
      expect(result).toBeNull();
    });

    it('retries on network failure and returns null on persistent error', async () => {
      axios.get.mockRejectedValue(new Error('Connection timeout'));

      const result = await fetchNasaWeather(27.53, 71.91, 24, 'solar');
      expect(result).toBeNull();
      // Initial call + 2 retries = 3 calls
      expect(axios.get).toHaveBeenCalledTimes(3);
    });

    it('handles 429 rate limit responses by backing off', async () => {
      axios.get
        .mockResolvedValueOnce({ status: 429, data: { message: 'Too Many Requests' } })
        .mockResolvedValueOnce({ status: 200, data: mockSolarData });

      const result = await fetchNasaWeather(27.53, 71.91, 3, 'solar');
      expect(result).not.toBeNull();
      expect(result.length).toBe(3);
    });

    it('correctly normalises records from the local FastAPI proxy format', () => {
      const proxyRecords = {
        records: [
          {
            time: '2024-01-01T00:00:00.000Z',
            timeKey: '2024010100',
            ALLSKY_SFC_SW_DWN: 0.0,
            CLRSKY_SFC_SW_DWN: 0.0,
            T2M: 14.5,
            RH2M: 60.0,
            WS10M: 3.5,
            WS50M: 5.8,
            WD10M: 110.0,
            CLOUD_AMT: 15.0,
          },
        ],
      };

      const result = normaliseNasaPower(proxyRecords, 1, 'wind');
      expect(result.length).toBe(1);
      expect(result[0].windSpeedMs).toBe(5.8); // Prefers 50m hub height
      expect(result[0].temperatureC).toBe(14.5);
      expect(result[0].cloudCoverPct).toBe(15.0);
    });
  });
});
