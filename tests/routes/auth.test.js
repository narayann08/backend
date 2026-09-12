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

describe('GET /v1/auth/roles', () => {
  it('lists the three predefined login roles', async () => {
    const res = await request(app).get('/v1/auth/roles');
    expect(res.status).toBe(200);
    expect(res.body.roles).toEqual([
      { key: 'system-admin', role: 'admin', label: 'System Admin' },
      { key: 'lead-grid-operator', role: 'grid_operator', label: 'Lead Grid Operator' },
      { key: 'utility-admin', role: 'utility_admin', label: 'Utility Admin' },
    ]);
  });
});

describe('POST /v1/auth/login/:role — one-click login', () => {
  beforeEach(() => jest.clearAllMocks());

  it('logs in as System Admin without any credentials', async () => {
    const mockUser = {
      _id:   new mongoose.Types.ObjectId(),
      email: 'admin@fluxcast.io',
      name:  'System Admin',
      role:  'admin',
    };
    User.findOne.mockResolvedValue(mockUser);

    const res = await request(app).post('/v1/auth/login/system-admin').send();

    expect(User.findOne).toHaveBeenCalledWith({ role: 'admin' });
    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty('token');
    expect(res.body.user).toMatchObject({ email: 'admin@fluxcast.io', role: 'admin' });
  });

  it('logs in as Lead Grid Operator without any credentials', async () => {
    const mockUser = {
      _id:   new mongoose.Types.ObjectId(),
      email: 'operator@fluxcast.io',
      name:  'Lead Grid Operator',
      role:  'grid_operator',
    };
    User.findOne.mockResolvedValue(mockUser);

    const res = await request(app).post('/v1/auth/login/lead-grid-operator').send();

    expect(User.findOne).toHaveBeenCalledWith({ role: 'grid_operator' });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email: 'operator@fluxcast.io', role: 'grid_operator' });
  });

  it('logs in as Utility Admin without any credentials', async () => {
    const mockUser = {
      _id:   new mongoose.Types.ObjectId(),
      email: 'utility@fluxcast.io',
      name:  'Utility Administrator',
      role:  'utility_admin',
    };
    User.findOne.mockResolvedValue(mockUser);

    const res = await request(app).post('/v1/auth/login/utility-admin').send();

    expect(User.findOne).toHaveBeenCalledWith({ role: 'utility_admin' });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email: 'utility@fluxcast.io', role: 'utility_admin' });
  });

  it('returns 404 when no stored user exists for the role', async () => {
    User.findOne.mockResolvedValue(null);
    const res = await request(app).post('/v1/auth/login/utility-admin').send();
    expect(res.status).toBe(404);
    expect(res.body.error).toBe(true);
  });

  it('does not expose the old email/password login endpoint', async () => {
    const res = await request(app)
      .post('/v1/auth/login')
      .send({ email: 'admin@fluxcast.io', password: 'Password123!' });
    expect(res.status).toBe(404);
  });
});
