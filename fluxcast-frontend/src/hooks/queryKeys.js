/**
 * Central query-key factory. Every hook builds keys from here so cache
 * invalidation (e.g. after acknowledging an alert) can target exactly the right
 * entries without string-matching by hand.
 */
export const queryKeys = {
  roles: ['auth', 'roles'],

  plants: (filters = {}) => ['plants', filters],
  plant: (plantId) => ['plant', plantId],

  liveGeneration: (plantId) => ['plant', plantId, 'generation-live'],
  performance: (plantId) => ['plant', plantId, 'performance'],
  telemetry: (plantId, days) => ['plant', plantId, 'telemetry', days],

  weather: (plantId, hours) => ['plant', plantId, 'weather', hours],
  forecast: (plantId, horizon) => ['plant', plantId, 'forecast', horizon],
  history: (plantId, from, to) => ['plant', plantId, 'history', from, to],

  recommendation: (plantId) => ['plant', plantId, 'recommendation'],
  recommendations: (plantId, limit) => ['plant', plantId, 'recommendations', limit],
  explanation: (plantId) => ['plant', plantId, 'explain'],

  alerts: (filters = {}) => ['alerts', filters],
  notifications: (filters = {}) => ['notifications', filters],
};
