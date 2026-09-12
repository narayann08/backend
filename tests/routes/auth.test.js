'use strict';

// ── Must be set before any require() ──────────────────────────────────────
process.env.MONGODB_URI = 'mongodb://localhost:27017/fluxcast_test';
process.env.JWT_SECRET  = 'test_secret_key';
process.env.NODE_ENV    = 'test';

// ── Mock heavy/external modules BEFORE requiring app ─────────────────────
jest.mock('../../src/models/User');
jest.mock('../../src/config/db', () => ({ connectDB: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../src/sockets/alertSocket', () => ({ initSocket: jest.fn(), emitAlert: jest.fn() }));

// Bypass express-openapi-validator entirely in tests
jest.mock('express-openapi-validator', () => ({
  middleware: () => [(req, res, next) => next()],
}));

const request  = require('supertest');
const mongoose = require('mongoose');
const User     = require('../../src/models/User');
const app      = require('../../src/app');

describe('POST /v1/auth/login', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 for unknown user', async () => {
    User.findOne.mockResolvedValue(null);
    const res = await request(app)
      .post('/v1/auth/login')
      .send({ email: 'nobody@example.com', password: 'wrong' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe(true);
  });

  it('returns 401 for wrong password', async () => {
    const mockUser = {
      _id:             new mongoose.Types.ObjectId(),
      email:           'user@example.com',
      name:            'Test User',
      role:            'grid_operator',
      comparePassword: jest.fn().mockResolvedValue(false),
    };
    User.findOne.mockResolvedValue(mockUser);
    const res = await request(app)
      .post('/v1/auth/login')
      .send({ email: 'user@example.com', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('returns token and user on valid credentials', async () => {
    const mockUser = {
      _id:             new mongoose.Types.ObjectId(),
      email:           'admin@fluxcast.io',
      name:            'Admin',
      role:            'admin',
      comparePassword: jest.fn().mockResolvedValue(true),
    };
    User.findOne.mockResolvedValue(mockUser);
    const res = await request(app)
      .post('/v1/auth/login')
      .send({ email: 'admin@fluxcast.io', password: 'correct' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.email).toBe('admin@fluxcast.io');
  });
});
