import client from './client';

/**
 * Alerts, newest first. The backend returns a bare array.
 * @param {{severity?: 'low'|'medium'|'high', plantId?: string}} filters
 *   Omit `severity` for the "All" tab — there is no server-side "all" value.
 */
export async function fetchAlerts({ severity, plantId } = {}) {
  const { data } = await client.get('/alerts', {
    params: { ...(severity ? { severity } : {}), ...(plantId ? { plantId } : {}) },
  });
  return data;
}

/** Mark an alert as handled by an operator. Returns the updated alert. */
export async function acknowledgeAlert(alertId) {
  const { data } = await client.post(`/alerts/${alertId}/acknowledge`);
  return data;
}

/**
 * Delivery log for alert notifications (socket pushes and email escalations).
 * Read-only: sending is backend-only, the UI never triggers it.
 */
export async function fetchNotifications({ plantId, channel, status, limit = 20 } = {}) {
  const { data } = await client.get('/notifications', {
    params: { plantId, channel, status, limit },
  });
  return data;
}
