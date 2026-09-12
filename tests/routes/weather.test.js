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
jest.mock('../../src/services/agents/weatherReasoningAgent');

const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const Plant = require('../../src/models/Plant');
const { runWeatherReasoningAgent } = require('../../src/services/agents/weatherReasoningAgent');
const app = require('../../src/app');

const token = jwt.sign(
  { id: 'u1', email: 'operator@fluxcast.io', role: 'grid_operator', name: 'Operator' },
  'test_secret_key',
  { expiresIn: '1h' }
);
const auth = `Bearer ${token}`;

describe('Weather Routes', () => {
  const plantId = new mongoose.Types.ObjectId();
  const mockPlant = {
    _id: plantId,
    name: 'Bhadla Solar',
    type: 'solar',
    latitude: 27.53,
    longitude: 71.91,
    capacityMW: 500,
  };

  beforeEach(() => jest.clearAllMocks());

  describe('GET /v1/plants/:plantId/weather', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get(`/v1/plants/${plantId}/weather`);
      expect(res.status).toBe(401);
    });

    it('returns 404 if plant not found', async () => {
      Plant.findById.mockReturnValue({ lean: () => null });

      const res = await request(app)
        .get(`/v1/plants/${plantId}/weather`)
        .set('Authorization', auth);

      expect(res.status).toBe(404);
    });

    it('returns reconciled weather snapshot', async () => {
      Plant.findById.mockReturnValue({ lean: () => mockPlant });
      const mockSnapshot = {
        _id: new mongoose.Types.ObjectId(),
        plantId,
        source: 'open-meteo+nasa-power (reconciled)',
        hourly: [
          { time: new Date(), cloudCoverPct: 15, ghiWm2: 650, temperatureC: 32 },
        ],
      };
      runWeatherReasoningAgent.mockResolvedValue(mockSnapshot);

      const res = await request(app)
        .get(`/v1/plants/${plantId}/weather?hours=48`)
        .set('Authorization', auth);

      expect(res.status).toBe(200);
      expect(res.body.source).toBe('open-meteo+nasa-power (reconciled)');
      expect(runWeatherReasoningAgent).toHaveBeenCalledWith(mockPlant, 48);
    });
  });
});
