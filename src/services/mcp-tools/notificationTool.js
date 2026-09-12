'use strict';
const Alert = require('../../models/Alert');
const { emitAlert } = require('../../sockets/alertSocket');
const logger = require('../../utils/logger');

/**
 * MCP Tool: notificationTool
 *
 * Raise a real-time alert when a risk window is detected.
 * Writes to the alerts collection and emits via Socket.IO to all dashboard clients.
 * This is also the hook point for future email/SMS integrations.
 */
const notificationTool = {
  name: 'notificationTool',
  description:
    'Raise a real-time alert when a risk window or dangerous condition is detected. ' +
    'Use this when the forecast contains a risk window or the recommendation flags an urgent constraint. ' +
    'Always include a clear, operator-readable message explaining the risk.',
  inputSchema: {
    type: 'object',
    required: ['plantId', 'severity', 'type', 'message'],
    properties: {
      plantId:  { type: 'string' },
      severity: { type: 'string', enum: ['low', 'medium', 'high'] },
      type: {
        type: 'string',
        enum: ['curtailment_risk', 'shortfall_risk', 'storage_limit', 'sensor_fault', 'extreme_weather'],
      },
      message: { type: 'string' },
    },
  },
  /**
   * @param {{ plantId: string, severity: string, type: string, message: string }} input
   */
  async handler(input) {
    const { plantId, severity, type, message } = input;
    const alert = await Alert.create({ plantId, severity, type, message });

    // Push real-time notification to all connected dashboard clients
    emitAlert({
      id:        alert._id,
      plantId,
      severity,
      type,
      message,
      createdAt: alert.createdAt,
    });

    logger.info(`[NotificationTool] Alert raised: [${severity}] ${type} for plant ${plantId}`);
    return { success: true, alertId: alert._id };
  },
};

module.exports = notificationTool;
