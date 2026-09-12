'use strict';

process.env.MONGODB_URI = 'mongodb://localhost:27017/fluxcast_test';
process.env.JWT_SECRET  = 'test_secret_key';
process.env.NODE_ENV    = 'test';

jest.mock('../../src/config/db', () => ({ connectDB: jest.fn() }));
jest.mock('../../src/sockets/alertSocket', () => ({ initSocket: jest.fn(), emitAlert: jest.fn() }));
jest.mock('express-openapi-validator', () => ({
  middleware: () => [(req, res, next) => next()],
}));
jest.mock('../../src/models/Alert');

const request  = require('supertest');
const mongoose = require('mongoose');
const Alert    = require('../../src/models/Alert');
const app      = require('../../src/app');

const auth = { 'x-user-role': 'grid_operator' };

describe('Alert Routes', () => {
  const mockAlert = {
    _id:          new mongoose.Types.ObjectId(),
    plantId:      new mongoose.Types.ObjectId(),
    severity:     'high',
    type:         'shortfall_risk',
    message:      'Test alert',
    acknowledged: false,
    createdAt:    new Date(),
  };

  beforeEach(() => jest.clearAllMocks());

  describe('GET /v1/alerts', () => {
    it('returns list of alerts', async () => {
      Alert.find.mockReturnValue({ sort: () => ({ lean: () => [mockAlert] }) });
      const res = await request(app).get('/v1/alerts').set(auth);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0].severity).toBe('high');
    });

    it('is reachable without any auth header (no recurring token check)', async () => {
      Alert.find.mockReturnValue({ sort: () => ({ lean: () => [mockAlert] }) });
      const res = await request(app).get('/v1/alerts');
      expect(res.status).toBe(200);
    });
  });

  describe('POST /v1/alerts/:alertId/acknowledge', () => {
    it('acknowledges an alert', async () => {
      Alert.findByIdAndUpdate.mockReturnValue({
        lean: () => ({ ...mockAlert, acknowledged: true }),
      });
      const res = await request(app)
        .post(`/v1/alerts/${mockAlert._id}/acknowledge`)
        .set(auth);
      expect(res.status).toBe(200);
      expect(res.body.acknowledged).toBe(true);
    });

    it('returns 404 for missing alert', async () => {
      Alert.findByIdAndUpdate.mockReturnValue({ lean: () => null });
      const res = await request(app)
        .post(`/v1/alerts/${new mongoose.Types.ObjectId()}/acknowledge`)
        .set(auth);
      expect(res.status).toBe(404);
    });
  });
});
