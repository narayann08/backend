'use strict';
const path = require('path');
const { middleware: openApiValidator } = require('express-openapi-validator');

/**
 * Returns configured express-openapi-validator middleware array.
 * Validates all requests against openapi.yaml.
 * Ignores /health (internal, not in spec).
 */
function setupOpenApiValidator() {
  return openApiValidator({
    apiSpec: path.join(__dirname, '../../openapi.yaml'),
    validateRequests: true,
    validateResponses: false,
    ignorePaths: (path) => path.startsWith('/health'),
  });
}

module.exports = { setupOpenApiValidator };
