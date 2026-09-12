import client from './client';

/** The single latest recommendation. 404s when the agent has not run yet. */
export async function fetchLatestRecommendation(plantId) {
  const { data } = await client.get(`/plants/${plantId}/recommendation`);
  return data;
}

/**
 * Recommendation feed for the notice board, newest first.
 * Returns `{ total: 0, recommendations: [] }` when empty — never a 404.
 */
export async function fetchRecommendations(plantId, limit = 20) {
  const { data } = await client.get(`/plants/${plantId}/recommendations`, { params: { limit } });
  return data;
}

/** Plain-language rationale for the current forecast/recommendation. */
export async function fetchExplanation(plantId) {
  const { data } = await client.get(`/plants/${plantId}/explain`);
  return data;
}

/**
 * Ask the plant-scoped assistant a question.
 *
 * The backend answers only from this plant's stored data and returns 503 when
 * the model is unreachable — it never invents a reply, so errors must surface
 * to the operator rather than being swallowed.
 *
 * @param {string} plantId
 * @param {string} message
 * @param {Array<{role: 'user'|'assistant', content: string}>} history
 */
export async function askChatbot(plantId, message, history = []) {
  const { data } = await client.post(`/plants/${plantId}/chat`, { message, history });
  return data;
}
