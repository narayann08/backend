'use strict';
const nasaGisTool = require('./nasaGisTool');

/**
 * MCP Tool alias: nasaPowerTool
 * Direct alias for NASA POWER API tool.
 */
const nasaPowerTool = {
  ...nasaGisTool,
  name: 'nasaPowerTool',
};

module.exports = nasaPowerTool;
