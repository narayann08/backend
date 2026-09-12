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
jest.mock('../../src/models/WeatherSnapshot');
jest.mock('../../src/services/agents/weatherReasoningAgent');

const request = require('supertest');
const mongoose = require('mongoose');
const Plant = require('../../src/models/Plant');
const WeatherSnapshot = require('../../src/models/WeatherSnapshot');
const { runWeatherReasoningAgent } = require('../../src/services/agents/weatherReasoningAgent');
const app = require('../../src/app');

const auth = { 'x-user-role': 'grid_operator' };

/** Stub the "latest stored snapshot" query with a given document (or none). */
function mockStoredSnapshot(doc) {
  WeatherSnapshot.findOne.mockReturnValue({ sort: () => ({ lean: () => doc }) });
}

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

  const snapshotAt = (generatedAt) => ({
    _id: new mongoose.Types.ObjectId(),
    plantId,
    source: 'open-meteo+nasa-power (reconciled)',
    generatedAt,
    hourly: [
      { time: new Date(), cloudCoverPct: 15, ghiWm2: 650, temperatureC: 32, windSpeedMs: 3, rainProbabilityPct: 5 },
    ],
  });

  beforeEach(() => jest.clearAllMocks());

  describe('GET /v1/plants/:plantId/weather', () => {
    it('returns 404 if plant not found', async () => {
      Plant.findById.mockReturnValue({ lean: () => null });
      mockStoredSnapshot(null);

      const res = await request(app)
        .get(`/v1/plants/${plantId}/weather`)
        .set(auth);

      expect(res.status).toBe(404);
    });

    it('serves a fresh stored snapshot without re-running the agent', async () => {
      Plant.findById.mockReturnValue({ lean: () => mockPlant });
      mockStoredSnapshot(snapshotAt(new Date()));

      const res = await request(app)
        .get(`/v1/plants/${plantId}/weather`)
        .set(auth);

      expect(res.status).toBe(200);
      expect(res.body.cached).toBe(true);
      expect(runWeatherReasoningAgent).not.toHaveBeenCalled();
      expect(res.body.source).toBe('open-meteo+nasa-power (reconciled)');
    });

    it('re-runs the weather agent when the stored snapshot is stale', async () => {
      Plant.findById.mockReturnValue({ lean: () => mockPlant });
      // Two hours old, beyond the default 60-minute cache window.
      mockStoredSnapshot(snapshotAt(new Date(Date.now() - 2 * 60 * 60 * 1000)));
      runWeatherReasoningAgent.mockResolvedValue(snapshotAt(new Date()));

      const res = await request(app)
        .get(`/v1/plants/${plantId}/weather?hours=48`)
        .set(auth);

      expect(res.status).toBe(200);
      expect(res.body.cached).toBe(false);
      expect(runWeatherReasoningAgent).toHaveBeenCalledWith(mockPlant, 48);
    });

    it('forces a refresh when ?refresh=true even with a fresh snapshot', async () => {
      Plant.findById.mockReturnValue({ lean: () => mockPlant });
      mockStoredSnapshot(snapshotAt(new Date()));
      runWeatherReasoningAgent.mockResolvedValue(snapshotAt(new Date()));

      const res = await request(app)
        .get(`/v1/plants/${plantId}/weather?refresh=true`)
        .set(auth);

      expect(res.status).toBe(200);
      expect(runWeatherReasoningAgent).toHaveBeenCalled();
    });

    it('summarises current conditions for the map overlay', async () => {
      Plant.findById.mockReturnValue({ lean: () => mockPlant });
      mockStoredSnapshot(snapshotAt(new Date()));

      const res = await request(app)
        .get(`/v1/plants/${plantId}/weather`)
        .set(auth);

      expect(res.status).toBe(200);
      expect(res.body.condition).toBe('clear');
      expect(res.body.conditionLabel).toBe('Clear');
      expect(res.body.current).toMatchObject({ cloudCoverPct: 15 });
    });

    it('falls back to the stored snapshot when a forced refresh fails', async () => {
      Plant.findById.mockReturnValue({ lean: () => mockPlant });
      mockStoredSnapshot(snapshotAt(new Date()));
      runWeatherReasoningAgent.mockRejectedValue(new Error('Open-Meteo unreachable'));

      const res = await request(app)
        .get(`/v1/plants/${plantId}/weather?refresh=true`)
        .set(auth);

      expect(res.status).toBe(200);
      expect(res.body.hourly.length).toBe(1);
    });

    it('returns 503 when the agent fails and nothing is stored', async () => {
      Plant.findById.mockReturnValue({ lean: () => mockPlant });
      mockStoredSnapshot(null);
      runWeatherReasoningAgent.mockRejectedValue(new Error('Open-Meteo unreachable'));

      const res = await request(app)
        .get(`/v1/plants/${plantId}/weather`)
        .set(auth);

      expect(res.status).toBe(503);
      expect(res.body.error).toBe(true);
    });
  });
});
