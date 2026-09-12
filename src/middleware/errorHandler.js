'use strict';
const logger = require('../utils/logger');

/**
 * Global error handler middleware.
 * Must be registered last in Express middleware chain.
 * @param {Error} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // express-openapi-validator formats errors with .status and .errors
  if (err.status && err.errors) {
    return res.status(err.status).json({
      error: true,
      message: err.message,
      details: err.errors,
    });
  }

  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  if (status >= 500) {
    logger.error('Unhandled error:', { message, stack: err.stack });
  }

  res.status(status).json({ error: true, message });
}

module.exports = { errorHandler };
