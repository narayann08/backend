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
jest.mock('../../src/services/graph/forecastWorkflow', () => ({
  runForecastWorkflow: jest.fn().mockResolvedValue({}),
}));

const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const Plant = require('../../src/models/Plant');
const ForecastResult = require('../../src/models/ForecastResult');
const app = require('../../src/app');

const token = jwt.sign(
  { id: 'u1', email: 'operator@fluxcast.io', role: 'grid_operator', name: 'Operator' },
  'test_secret_key',
  { expiresIn: '1h' }
);
const auth = `Bearer ${token}`;

describe('Forecast Routes', () => {
  const plantId = new mongoose.Types.ObjectId();
  const mockPlant = {
    _id: plantId,
    name: 'Bhadla Solar',
    type: 'solar',
    capacityMW: 100,
  };

  beforeEach(() => jest.clearAllMocks());

  describe('GET /v1/plants/:plantId/forecast', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get(`/v1/plants/${plantId}/forecast`);
      expect(res.status).toBe(401);
    });

    it('returns 404 if no forecast exists', async () => {
      ForecastResult.findOne.mockReturnValue({
        sort: () => ({ lean: () => null }),
      });

      const res = await request(app)
        .get(`/v1/plants/${plantId}/forecast`)
        .set('Authorization', auth);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe(true);
    });

    it('returns forecast when found', async () => {
      const mockForecast = {
        _id: new mongoose.Types.ObjectId(),
        plantId,
        horizonHours: 24,
        points: [{ time: new Date(), expectedMW: 55 }],
        riskWindows: [],
      };
      ForecastResult.findOne.mockReturnValue({
        sort: () => ({ lean: () => mockForecast }),
      });

      const res = await request(app)
        .get(`/v1/plants/${plantId}/forecast?horizon=24`)
        .set('Authorization', auth);

      expect(res.status).toBe(200);
      expect(res.body.plantId).toBe(plantId.toString());
      expect(res.body.points.length).toBe(1);
    });
  });

  describe('POST /v1/plants/:plantId/forecast', () => {
    it('returns 404 if plant does not exist', async () => {
      Plant.findById.mockReturnValue({ lean: () => null });

      const res = await request(app)
        .post(`/v1/plants/${plantId}/forecast`)
        .set('Authorization', auth)
        .send({ horizon: 24 });

      expect(res.status).toBe(404);
    });

    it('queues a background forecast job and returns 202', async () => {
      Plant.findById.mockReturnValue({ lean: () => mockPlant });

      const res = await request(app)
        .post(`/v1/plants/${plantId}/forecast`)
        .set('Authorization', auth)
        .send({ horizon: 24 });

      expect(res.status).toBe(202);
      expect(res.body.status).toBe('queued');
      expect(res.body).toHaveProperty('jobId');
    });
  });
});
