import client from './client';

/**
 * Plants visible to the signed-in user. Every predefined role is
 * organisation-wide, so this returns the whole fleet (see ASSUMPTIONS.md).
 * @returns {Promise<{total: number, plants: Array<object>}>}
 */
export async function fetchPlants({ type, page = 1, limit = 50 } = {}) {
  const { data } = await client.get('/plants', { params: { type, page, limit } });
  return data;
}

/** A single plant's metadata and capacity specs. */
export async function fetchPlant(plantId) {
  const { data } = await client.get(`/plants/${plantId}`);
  return data;
}

/** Latest measured output paired with the forecast baseline for the same hour. */
export async function fetchLiveGeneration(plantId) {
  const { data } = await client.get(`/plants/${plantId}/generation/live`);
  return data;
}

/**
 * lower / usual / higher classification plus the attributed causes behind any
 * deviation. Backs both the map tooltip and the AI decisions card.
 */
export async function fetchPerformance(plantId) {
  const { data } = await client.get(`/plants/${plantId}/performance`);
  return data;
}

/** Raw SCADA readings for the last `days` days, oldest first. */
export async function fetchTelemetry(plantId, days = 4) {
  const { data } = await client.get(`/plants/${plantId}/telemetry`, { params: { days } });
  return data;
}
