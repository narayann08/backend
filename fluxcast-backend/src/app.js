'use strict';
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const { setupOpenApiValidator } = require('./middleware/openApiValidatorSetup');
const { errorHandler } = require('./middleware/errorHandler');

const authRoutes           = require('./routes/auth.routes');
const plantRoutes          = require('./routes/plants.routes');
const weatherRoutes        = require('./routes/weather.routes');
const forecastRoutes       = require('./routes/forecast.routes');
const recommendationRoutes = require('./routes/recommendation.routes');
const simulateRoutes       = require('./routes/simulate.routes');
const alertRoutes          = require('./routes/alerts.routes');
const portfolioRoutes      = require('./routes/portfolio.routes');

const app = express();

// ── Security & logging ─────────────────────────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ── Health check (excluded from OpenAPI validation) ────────────────────────
app.get('/health', (req, res) => {
  const mongoose = require('mongoose');
  const dbState  = mongoose.connection.readyState; // 1 = connected
  res.json({ status: 'ok', db: dbState === 1 ? 'connected' : 'disconnected' });
});

// ── OpenAPI request validation ─────────────────────────────────────────────
app.use(setupOpenApiValidator());

// ── Routes (all under /v1 matching openapi.yaml servers) ──────────────────
app.use('/v1/auth',               authRoutes);
app.use('/v1/plants',             plantRoutes);
app.use('/v1/plants/:plantId/weather',  weatherRoutes);
app.use('/v1/plants/:plantId/forecast', forecastRoutes);
app.use('/v1/plants/:plantId',          recommendationRoutes);
app.use('/v1/simulate',           simulateRoutes);
app.use('/v1/alerts',             alertRoutes);
app.use('/v1/portfolio',          portfolioRoutes);

// ── Global error handler (must be last) ───────────────────────────────────
app.use(errorHandler);

module.exports = app;
