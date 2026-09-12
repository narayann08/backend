import client from './client';

/**
 * Reconciled weather for a plant's coordinates, plus a `current` summary and a
 * `condition` label used to tint the dashboard map overlay.
 *
 * The backend serves a cached snapshot (60 min by default) so this is cheap to
 * poll; `refresh` forces a live agent run.
 */
export async function fetchWeather(plantId, { hours = 72, refresh = false } = {}) {
  const { data } = await client.get(`/plants/${plantId}/weather`, {
    params: { hours, ...(refresh ? { refresh: 'true' } : {}) },
  });
  return data;
}
