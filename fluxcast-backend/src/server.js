'use strict';
const http = require('http');
const app = require('./app');
const { connectDB } = require('./config/db');
const env = require('./config/env');
const logger = require('./utils/logger');
const { initSocket } = require('./sockets/alertSocket');
const { startForecastJob } = require('./jobs/scheduledForecastJob');
const { startWeatherPullJob } = require('./jobs/scheduledWeatherPull');

async function start() {
  // Connect to MongoDB Atlas first
  await connectDB();

  const server = http.createServer(app);

  // Initialise Socket.IO for real-time alert push
  initSocket(server);

  server.listen(env.PORT, () => {
    logger.info(`FluxCast server running on port ${env.PORT} [${env.NODE_ENV}]`);
  });

  // Start scheduled jobs
  startForecastJob();
  startWeatherPullJob();

  // Graceful shutdown on SIGTERM (e.g. from Docker/k8s)
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received — closing server');
    server.close(() => process.exit(0));
  });
}

start().catch(err => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
