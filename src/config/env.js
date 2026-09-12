'use strict';
require('dotenv').config();

/**
 * Centralised environment configuration.
 * Throws at startup if required variables are missing.
 */
const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT, 10) || 5000,

  MONGODB_URI: process.env.MONGODB_URI,

  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',

  XAI_API_KEY:   process.env.XAI_API_KEY  || '',
  XAI_BASE_URL:  process.env.XAI_BASE_URL || 'https://api.x.ai/v1',
  XAI_MODEL:     process.env.XAI_MODEL    || 'grok-beta',

  OPEN_METEO_BASE_URL:
    process.env.OPEN_METEO_BASE_URL ||
    'https://api.open-meteo.com/v1/forecast',

  // NASA POWER Proxy Server (Local FastAPI service in nasa-power-api-main)
  NASA_API_KEY: process.env.NASA_API_KEY || '',
  NASA_POWER_BASE_URL:
    process.env.NASA_POWER_BASE_URL ||
    'http://localhost:8000',

  REDIS_URL: process.env.REDIS_URL || '',
};

// Validate required vars at startup (skip in test environment)
if (process.env.NODE_ENV !== 'test') {
  const REQUIRED = ['MONGODB_URI', 'JWT_SECRET'];
  for (const key of REQUIRED) {
    if (!env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }
}

module.exports = env;
