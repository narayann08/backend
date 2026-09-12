import client from './client';

/**
 * Most recent forecast for the given horizon.
 * The backend answers 404 when no run has completed yet, which callers treat as
 * "not ready" rather than an error.
 * @param {string} plantId
 * @param {24|48|72} horizon
 */
export async function fetchForecast(plantId, horizon = 24) {
  const { data } = await client.get(`/plants/${plantId}/forecast`, { params: { horizon } });
  return data;
}

/** Queue a fresh agent run. Returns `{ jobId, status }`; results arrive async. */
export async function triggerForecast(plantId, horizon = 24) {
  const { data } = await client.post(`/plants/${plantId}/forecast`, { horizon });
  return data;
}

/**
 * Hourly forecast-vs-actual series plus confidence, over a date range.
 * @param {{from?: Date|string, to?: Date|string}} range
 */
export async function fetchHistory(plantId, { from, to } = {}) {
  const params = {};
  if (from) params.from = from instanceof Date ? from.toISOString() : from;
  if (to) params.to = to instanceof Date ? to.toISOString() : to;
  const { data } = await client.get(`/plants/${plantId}/history`, { params });
  return data;
}
