'use strict';

process.env.MONGODB_URI = 'mongodb://localhost:27017/fluxcast_test';
process.env.JWT_SECRET  = 'test_secret_key';
process.env.NODE_ENV    = 'test';

jest.mock('../../src/config/db', () => ({ connectDB: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../src/sockets/alertSocket', () => ({ initSocket: jest.fn(), emitAlert: jest.fn() }));
jest.mock('express-openapi-validator', () => ({
  middleware: () => [(req, res, next) => next()],
}));
jest.mock('../../src/models/Plant');
jest.mock('../../src/models/Telemetry');

const request   = require('supertest');
const mongoose  = require('mongoose');
const Plant     = require('../../src/models/Plant');
const app       = require('../../src/app');

const auth = { 'x-user-role': 'admin' };

const mockPlant = {
  _id:               new mongoose.Types.ObjectId(),
  name:              'Test Solar Farm',
  type:              'solar',
  latitude:          22.5,
  longitude:         70.1,
  capacityMW:        10,
  hasLimitedHistory: false,
};

describe('Plant Routes', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('GET /v1/plants', () => {
    it('is reachable without any auth header (no recurring token check)', async () => {
      Plant.find.mockReturnValue({
        skip: () => ({ limit: () => ({ lean: () => [mockPlant] }) }),
      });
      Plant.countDocuments.mockResolvedValue(1);
      const res = await request(app).get('/v1/plants');
      expect(res.status).toBe(200);
    });

    it('returns paginated list of plants', async () => {
      Plant.find.mockReturnValue({
        skip: () => ({ limit: () => ({ lean: () => [mockPlant] }) }),
      });
      Plant.countDocuments.mockResolvedValue(1);
      const res = await request(app).get('/v1/plants').set(auth);
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(Array.isArray(res.body.plants)).toBe(true);
    });
  });

  describe('POST /v1/plants', () => {
    it('creates a plant and returns 201', async () => {
      Plant.create.mockResolvedValue({ ...mockPlant, toObject: () => mockPlant });
      const res = await request(app)
        .post('/v1/plants')
        .set(auth)
        .send({ name: 'Test Solar Farm', type: 'solar', latitude: 22.5, longitude: 70.1, capacityMW: 10 });
      expect(res.status).toBe(201);
    });
  });

  describe('GET /v1/plants/:plantId', () => {
    it('returns 404 for missing plant', async () => {
      Plant.findById.mockReturnValue({ lean: () => null });
      const res = await request(app)
        .get(`/v1/plants/${new mongoose.Types.ObjectId()}`)
        .set(auth);
      expect(res.status).toBe(404);
    });

    it('returns plant when found', async () => {
      Plant.findById.mockReturnValue({ lean: () => mockPlant });
      const res = await request(app)
        .get(`/v1/plants/${mockPlant._id}`)
        .set(auth);
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Test Solar Farm');
    });
  });

  describe('DELETE /v1/plants/:plantId', () => {
    it('returns 403 for grid_operator role', async () => {
      const res = await request(app)
        .delete(`/v1/plants/${mockPlant._id}`)
        .set({ 'x-user-role': 'grid_operator' });
      expect(res.status).toBe(403);
    });

    it('allows deletion for admin role', async () => {
      Plant.findByIdAndDelete.mockResolvedValue(mockPlant);
      const res = await request(app)
        .delete(`/v1/plants/${mockPlant._id}`)
        .set(auth);
      expect(res.status).toBe(204);
    });
  });
});
