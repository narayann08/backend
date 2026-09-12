'use strict';
const mongoose = require('mongoose');
const env = require('./env');
const logger = require('../utils/logger');

const LOCAL_FALLBACK_URI = 'mongodb://127.0.0.1:27017/fluxcast';

/**
 * Connect to MongoDB.
 * Attempts configured MONGODB_URI first; if it fails (e.g. invalid Atlas hostname or network error),
 * automatically falls back to the running local MongoDB instance.
 * @returns {Promise<void>}
 */
async function connectDB() {
  const primaryUri = env.MONGODB_URI;

  if (primaryUri) {
    try {
      await mongoose.connect(primaryUri, {
        serverSelectionTimeoutMS: 5000,
      });
      logger.info('MongoDB connected successfully to primary URI');
      return;
    } catch (err) {
      logger.warn(`Primary MongoDB connection failed: ${err.message}. Attempting local fallback...`);
    }
  }

  // Attempt fallback to local MongoDB
  try {
    await mongoose.connect(LOCAL_FALLBACK_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    logger.info(`MongoDB connected successfully to local instance: ${LOCAL_FALLBACK_URI}`);
  } catch (err) {
    logger.error('All MongoDB connection attempts failed:', err.message);
    process.exit(1);
  }
}

module.exports = { connectDB };
