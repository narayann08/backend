'use strict';
const { nearestByTime } = require('./performanceService');

/**
 * Reduce an hourly weather snapshot to the conditions right now, plus a single
 * condition label the dashboard map uses to tint its weather overlay.
 *
 * @param {object} snapshot - WeatherSnapshot document (lean)
 * @returns {{current: object|null, condition: string, conditionLabel: string}}
 */
function summariseCurrent(snapshot) {
  const current = snapshot?.hourly?.length ? nearestByTime(snapshot.hourly, new Date()) : null;

  if (!current) {
    return { current: null, condition: 'unknown', conditionLabel: 'No weather data' };
  }

  const {
    cloudCoverPct = null,
    rainProbabilityPct = null,
    windSpeedMs = null,
    temperatureC = null,
  } = current;

  // Ordered by operational significance: storm risk first, then wind, then sky.
  let condition = 'clear';
  let conditionLabel = 'Clear';

  if (typeof rainProbabilityPct === 'number' && rainProbabilityPct >= 60) {
    condition = 'rain';
    conditionLabel = 'Rain likely';
  } else if (typeof windSpeedMs === 'number' && windSpeedMs >= 15) {
    condition = 'windy';
    conditionLabel = 'High wind';
  } else if (typeof cloudCoverPct === 'number' && cloudCoverPct >= 70) {
    condition = 'cloudy';
    conditionLabel = 'Overcast';
  } else if (typeof cloudCoverPct === 'number' && cloudCoverPct >= 30) {
    condition = 'partly_cloudy';
    conditionLabel = 'Partly cloudy';
  } else if (typeof temperatureC === 'number' && temperatureC >= 38) {
    condition = 'hot';
    conditionLabel = 'Extreme heat';
  }

  return { current, condition, conditionLabel };
}

module.exports = { summariseCurrent };
