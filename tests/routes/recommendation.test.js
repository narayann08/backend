'use strict';

process.env.MONGODB_URI = 'mongodb://localhost:27017/fluxcast_test';
process.env.JWT_SECRET  = 'test_secret_key';
process.env.NODE_ENV    = 'test';

jest.mock('../../src/config/db', () => ({ connectDB: jest.fn() }));
jest.mock('../../src/sockets/alertSocket', () => ({ initSocket: jest.fn(), emitAlert: jest.fn() }));
jest.mock('express-openapi-validator', () => ({
  middleware: () => [(req, res, next) => next()],
}));
jest.mock('../../src/models/Recommendation');

const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const Recommendation = require('../../src/models/Recommendation');
const app = require('../../src/app');

const token = jwt.sign(
  { id: 'u1', email: 'operator@fluxcast.io', role: 'grid_operator', name: 'Operator' },
  'test_secret_key',
  { expiresIn: '1h' }
);
const auth = `Bearer ${token}`;

describe('Recommendation & Explain Routes', () => {
  const plantId = new mongoose.Types.ObjectId();
  const mockRec = {
    _id: new mongoose.Types.ObjectId(),
    plantId,
    action: 'charge_battery',
    amountMW: 25,
    durationHours: 2,
    reasoning: 'Solar peak generation exceeds immediate local demand; charge storage.',
    constraintsConsidered: ['battery_capacity', 'demand_forecast'],
  };

  beforeEach(() => jest.clearAllMocks());

  describe('GET /v1/plants/:plantId/recommendation', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get(`/v1/plants/${plantId}/recommendation`);
      expect(res.status).toBe(401);
    });

    it('returns 404 if no recommendation found', async () => {
      Recommendation.findOne.mockReturnValue({
        sort: () => ({ lean: () => null }),
      });

      const res = await request(app)
        .get(`/v1/plants/${plantId}/recommendation`)
        .set('Authorization', auth);

      expect(res.status).toBe(404);
    });

    it('returns recommendation when found', async () => {
      Recommendation.findOne.mockReturnValue({
        sort: () => ({ lean: () => mockRec }),
      });

      const res = await request(app)
        .get(`/v1/plants/${plantId}/recommendation`)
        .set('Authorization', auth);

      expect(res.status).toBe(200);
      expect(res.body.action).toBe('charge_battery');
      expect(res.body.amountMW).toBe(25);
    });
  });

  describe('GET /v1/plants/:plantId/explain', () => {
    it('returns 404 if no recommendation exists for explanation', async () => {
      Recommendation.findOne.mockReturnValue({
        sort: () => ({ lean: () => null }),
      });

      const res = await request(app)
        .get(`/v1/plants/${plantId}/explain`)
        .set('Authorization', auth);

      expect(res.status).toBe(404);
    });

    it('returns plain language explanation and factors', async () => {
      Recommendation.findOne.mockReturnValue({
        sort: () => ({ lean: () => mockRec }),
      });

      const res = await request(app)
        .get(`/v1/plants/${plantId}/explain`)
        .set('Authorization', auth);

      expect(res.status).toBe(200);
      expect(res.body.summary).toContain('Solar peak generation');
      expect(res.body.factors).toContain('battery_capacity');
    });
  });
});
