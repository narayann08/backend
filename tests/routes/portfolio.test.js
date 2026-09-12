'use strict';

process.env.MONGODB_URI = 'mongodb://localhost:27017/fluxcast_test';
process.env.JWT_SECRET  = 'test_secret_key';
process.env.NODE_ENV    = 'test';

jest.mock('../../src/config/db', () => ({ connectDB: jest.fn() }));
jest.mock('../../src/sockets/alertSocket', () => ({ initSocket: jest.fn(), emitAlert: jest.fn() }));
jest.mock('express-openapi-validator', () => ({
  middleware: () => [(req, res, next) => next()],
}));
jest.mock('../../src/models/Plant');
jest.mock('../../src/models/ForecastResult');

const request = require('supertest');
const mongoose = require('mongoose');
const Plant = require('../../src/models/Plant');
const ForecastResult = require('../../src/models/ForecastResult');
const app = require('../../src/app');

const auth = { 'x-user-role': 'grid_operator' };

describe('Portfolio Routes', () => {
  const plantId1 = new mongoose.Types.ObjectId();
  const plantId2 = new mongoose.Types.ObjectId();

  beforeEach(() => jest.clearAllMocks());

  describe('GET /v1/portfolio/forecast', () => {
    it('is reachable without any auth header (no recurring token check)', async () => {
      Plant.find.mockReturnValue({
        select: () => ({ lean: () => [] }),
      });
      const res = await request(app).get('/v1/portfolio/forecast');
      expect(res.status).toBe(200);
    });

    it('returns empty breakdown when no forecasts exist', async () => {
      Plant.find.mockReturnValue({
        select: () => ({
          lean: () => [{ _id: plantId1 }],
        }),
      });
      ForecastResult.findOne.mockReturnValue({
        sort: () => ({ lean: () => null }),
      });

      const res = await request(app)
        .get('/v1/portfolio/forecast')
        .set(auth);

      expect(res.status).toBe(200);
      expect(res.body.totalExpectedMW).toEqual([]);
      expect(res.body.plantBreakdown).toEqual([]);
    });

    it('aggregates forecasts across multiple plants correctly', async () => {
      const now = new Date('2026-09-12T12:00:00Z');
      const forecast1 = {
        plantId: plantId1,
        horizonHours: 24,
        points: [
          { time: now, expectedMW: 40, lowerBoundMW: 35, upperBoundMW: 45 },
        ],
      };
      const forecast2 = {
        plantId: plantId2,
        horizonHours: 24,
        points: [
          { time: now, expectedMW: 60, lowerBoundMW: 50, upperBoundMW: 70 },
        ],
      };

      ForecastResult.findOne
        .mockReturnValueOnce({ sort: () => ({ lean: () => forecast1 }) })
        .mockReturnValueOnce({ sort: () => ({ lean: () => forecast2 }) });

      const res = await request(app)
        .get(`/v1/portfolio/forecast?plantIds=${plantId1},${plantId2}&horizon=24`)
        .set(auth);

      expect(res.status).toBe(200);
      expect(res.body.horizonHours).toBe(24);
      expect(res.body.totalExpectedMW.length).toBe(1);
      expect(res.body.totalExpectedMW[0].expectedMW).toBe(100);
      expect(res.body.plantBreakdown.length).toBe(2);
    });
  });
});
