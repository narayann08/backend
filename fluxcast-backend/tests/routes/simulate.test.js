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
jest.mock('../../src/services/graph/forecastWorkflow');

const request = require('supertest');
const mongoose = require('mongoose');
const Plant = require('../../src/models/Plant');
const { runForecastWorkflow } = require('../../src/services/graph/forecastWorkflow');
const app = require('../../src/app');

const auth = { 'x-user-role': 'grid_operator' };

describe('Simulation Routes', () => {
  const plantId = new mongoose.Types.ObjectId();
  const mockPlant = {
    _id: plantId,
    name: 'Bhadla Solar',
    type: 'solar',
    capacityMW: 200,
  };

  beforeEach(() => jest.clearAllMocks());

  describe('POST /v1/simulate', () => {
    it('returns 404 if target plant does not exist', async () => {
      Plant.findById.mockReturnValue({ lean: () => null });

      const res = await request(app)
        .post('/v1/simulate')
        .set(auth)
        .send({
          plantId,
          scenario: '20% cloudy morning',
          overrides: { cloudCoverPct: 80 },
        });

      expect(res.status).toBe(404);
    });

    it('runs simulation workflow without DB persistence and returns results', async () => {
      Plant.findById.mockReturnValue({ lean: () => mockPlant });
      runForecastWorkflow.mockResolvedValue({
        forecast: { points: [{ expectedMW: 45 }] },
        recommendation: { action: 'discharge_battery', amountMW: 15 },
        explanation: 'Simulated cloud cover reduced solar generation.',
      });

      const res = await request(app)
        .post('/v1/simulate')
        .set(auth)
        .send({
          plantId,
          scenario: 'Cloud cover spike',
          overrides: { cloudCoverPct: 80 },
        });

      expect(res.status).toBe(200);
      expect(res.body.scenario).toBe('Cloud cover spike');
      expect(res.body.recommendation.action).toBe('discharge_battery');
      expect(runForecastWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({
          simulationMode: true,
          scenario: 'Cloud cover spike',
        })
      );
    });
  });
});
