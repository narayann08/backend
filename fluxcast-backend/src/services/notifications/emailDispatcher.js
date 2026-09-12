'use strict';
const nodemailer = require('nodemailer');
const env = require('../../config/env');
const logger = require('../../utils/logger');

/**
 * Email escalation for alerts.
 *
 * Only high-severity alerts and sensor faults escalate to email — everything
 * else stays in the dashboard feed. Sending is backend-only: the frontend
 * displays the resulting dispatch log but never triggers a send itself.
 */

/** @type {import('nodemailer').Transporter|null} */
let transporter = null;

function isConfigured() {
  return Boolean(env.SMTP_HOST && env.ALERT_EMAIL_TO);
}

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

/**
 * Decide whether an alert warrants an email escalation.
 * @param {{severity: string, type: string}} alert
 */
function shouldEscalate(alert) {
  return alert.severity === 'high' || alert.type === 'sensor_fault';
}

/**
 * Attempt to email an alert.
 * @param {{plantId: string, plantName?: string, severity: string, type: string, message: string}} alert
 * @returns {Promise<{status: 'sent'|'skipped'|'failed', recipient?: string, subject?: string, detail?: string}>}
 */
async function dispatchAlertEmail(alert) {
  if (!shouldEscalate(alert)) {
    return { status: 'skipped', detail: 'Severity below escalation threshold (high / sensor_fault only)' };
  }

  const subject = `[FluxCast ${alert.severity.toUpperCase()}] ${alert.type} — ${alert.plantName || alert.plantId}`;

  if (!isConfigured()) {
    logger.warn(`[EmailDispatcher] SMTP not configured — email skipped: ${subject}`);
    return {
      status: 'skipped',
      subject,
      detail: 'SMTP_HOST / ALERT_EMAIL_TO are not configured in the environment',
    };
  }

  try {
    await getTransporter().sendMail({
      from: env.ALERT_EMAIL_FROM,
      to: env.ALERT_EMAIL_TO,
      subject,
      text:
        `${alert.message}\n\n` +
        `Plant: ${alert.plantName || alert.plantId}\n` +
        `Severity: ${alert.severity}\n` +
        `Type: ${alert.type}\n` +
        `Raised at: ${new Date().toISOString()}\n`,
    });
    logger.info(`[EmailDispatcher] Alert email sent to ${env.ALERT_EMAIL_TO}: ${subject}`);
    return { status: 'sent', recipient: env.ALERT_EMAIL_TO, subject };
  } catch (err) {
    logger.error(`[EmailDispatcher] Failed to send alert email: ${err.message}`);
    return { status: 'failed', recipient: env.ALERT_EMAIL_TO, subject, detail: err.message };
  }
}

module.exports = { dispatchAlertEmail, shouldEscalate, isConfigured };
