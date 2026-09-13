'use strict';
const http = require('http');
const app = require('./app');
const { connectDB } = require('./config/db');
const env = require('./config/env');
const logger = require('./utils/logger');
const { initSocket } = require('./sockets/alertSocket');
const { startForecastJob } = require('./jobs/scheduledForecastJob');
const { startWeatherPullJob } = require('./jobs/scheduledWeatherPull');
const { startTelemetryJob } = require('./jobs/scheduledTelemetryJob');

async function start() {
  // Connect to MongoDB Atlas first
  await connectDB();

  const server = http.createServer(app);

  // Initialise Socket.IO for real-time alert push
  initSocket(server);

  server.listen(env.PORT, () => {
    logger.info(`FluxCast server running on port ${env.PORT} [${env.NODE_ENV}]`);
  });

  /*
   * Background jobs. Each runs every 15 minutes and once at start-up, staggered
   * so a cycle keeps its order: weather is pulled first, the telemetry reading
   * is priced against it, and the forecast runs on both.
   */
  startWeatherPullJob();
  startTelemetryJob();
  startForecastJob();

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
