'use strict';
const Telemetry = require('../../models/Telemetry');
const ForecastResult = require('../../models/ForecastResult');
const WeatherSnapshot = require('../../models/WeatherSnapshot');
const { impliedMW } = require('../forecast/generationModel');

/** Deviation inside ±10% of the forecast counts as operating "as usual". */
const USUAL_BAND_PCT = 10;

/** Below this MW, output is treated as effectively zero (e.g. solar at night). */
const ZERO_MW_EPSILON = 0.5;

/**
 * Classify actual generation against the forecast baseline.
 * @param {number|null} deltaPct
 * @returns {'lower'|'usual'|'higher'|'unknown'}
 */
function classify(deltaPct) {
  if (deltaPct === null || Number.isNaN(deltaPct)) return 'unknown';
  if (deltaPct < -USUAL_BAND_PCT) return 'lower';
  if (deltaPct > USUAL_BAND_PCT) return 'higher';
  return 'usual';
}

/**
 * Find the entry in a time series closest to a target timestamp.
 * @param {Array<{time?: Date, timestamp?: Date}>} series
 * @param {Date} target
 */
function nearestByTime(series, target) {
  if (!series || !series.length) return null;
  const t = new Date(target).getTime();
  let best = null;
  let bestDelta = Infinity;
  for (const entry of series) {
    const entryTime = new Date(entry.time || entry.timestamp).getTime();
    if (Number.isNaN(entryTime)) continue;
    const delta = Math.abs(entryTime - t);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = entry;
    }
  }
  return best;
}

/**
 * Output the observed weather alone would imply, using the same curves the
 * forecaster runs — one shared model, so "what the weather was worth" cannot
 * mean two different things in two places.
 *
 * @param {object} plant
 * @param {object} weatherHour
 * @returns {number|null} Implied generation in MW
 */
function weatherImpliedMW(plant, weatherHour) {
  return impliedMW(plant, weatherHour);
}

/**
 * Derive the operational/meteorological reasons behind a deviation, using only
 * measured telemetry and the stored weather snapshot — no guesswork.
 * @returns {Array<{code: string, detail: string, impact: 'high'|'medium'|'low'}>}
 */
function deriveReasons({ plant, latest, weatherHour, classification, hasBaseline, expectedMW, actualMW }) {
  const reasons = [];

  if (!hasBaseline) {
    reasons.push({
      code: 'no_forecast_baseline',
      detail: 'No forecast has been generated for this plant yet, so output cannot be compared to an expectation.',
      impact: 'medium',
    });
    return reasons;
  }

  // ── Equipment / sensor conditions (apply regardless of direction) ─────────
  if (latest?.outage) {
    reasons.push({
      code: 'outage',
      detail: 'The most recent telemetry reading is flagged as an outage.',
      impact: 'high',
    });
  }
  if (latest?.sensorStatus === 'offline') {
    reasons.push({
      code: 'sensor_offline',
      detail: 'The plant sensor is offline, so reported generation may be incomplete.',
      impact: 'high',
    });
  } else if (latest?.sensorStatus === 'degraded') {
    reasons.push({
      code: 'sensor_degraded',
      detail: 'The plant sensor is reporting degraded status, which reduces reading accuracy.',
      impact: 'medium',
    });
  }

  // ── Does the observed weather actually account for the deviation? ────────
  // Two independent questions, and both can be true at once:
  //   1. Did the weather come in worse than the forecast assumed?
  //   2. Is the plant delivering less than the current weather allows?
  const impliedNowMW = weatherImpliedMW(plant, weatherHour);

  if (classification === 'lower' && impliedNowMW !== null) {
    if (typeof expectedMW === 'number' && expectedMW > ZERO_MW_EPSILON && impliedNowMW < expectedMW * 0.85) {
      reasons.push({
        code: 'weather_below_forecast_assumption',
        detail:
          `Observed conditions support only about ${impliedNowMW.toFixed(1)} MW, ` +
          `against the ${expectedMW.toFixed(1)} MW the forecast assumed — the weather came in worse than predicted.`,
        impact: 'high',
      });
    }

    if (typeof actualMW === 'number' && impliedNowMW > ZERO_MW_EPSILON && actualMW < impliedNowMW * 0.85) {
      reasons.push({
        code: 'output_below_weather_potential',
        detail:
          `The plant is producing ${actualMW.toFixed(1)} MW where current conditions support about ` +
          `${impliedNowMW.toFixed(1)} MW — this gap is not explained by the weather, so check the equipment.`,
        impact: 'high',
      });
    }
  }

  // ── Weather-driven causes ─────────────────────────────────────────────────
  if (weatherHour) {
    const {
      cloudCoverPct, ghiWm2, temperatureC, rainProbabilityPct,
      windSpeedMs, turbulenceIndex,
    } = weatherHour;

    if (plant.type === 'solar') {
      if (classification === 'lower') {
        if (typeof cloudCoverPct === 'number' && cloudCoverPct >= 60) {
          reasons.push({
            code: 'high_cloud_cover',
            detail: `Cloud cover is ${Math.round(cloudCoverPct)}%, cutting the irradiance reaching the panels.`,
            impact: cloudCoverPct >= 80 ? 'high' : 'medium',
          });
        }
        if (typeof ghiWm2 === 'number' && ghiWm2 > 0 && ghiWm2 < 200) {
          reasons.push({
            code: 'low_irradiance',
            detail: `Global horizontal irradiance is only ${Math.round(ghiWm2)} W/m², well below peak-generation levels.`,
            impact: 'medium',
          });
        }
        if (typeof temperatureC === 'number' && temperatureC > 35) {
          reasons.push({
            code: 'heat_derating',
            detail: `Panel temperature derating: ambient is ${Math.round(temperatureC)}°C, above the 25°C rating point.`,
            impact: 'low',
          });
        }
        if (typeof rainProbabilityPct === 'number' && rainProbabilityPct >= 60) {
          reasons.push({
            code: 'rain',
            detail: `Rain probability is ${Math.round(rainProbabilityPct)}%, typically accompanied by heavy cloud.`,
            impact: 'medium',
          });
        }
      } else if (classification === 'higher') {
        if (typeof cloudCoverPct === 'number' && cloudCoverPct <= 20) {
          reasons.push({
            code: 'clear_sky',
            detail: `Clear conditions (${Math.round(cloudCoverPct)}% cloud cover) are delivering more irradiance than forecast.`,
            impact: 'medium',
          });
        }
      }
    }

    if (plant.type === 'wind') {
      if (classification === 'lower') {
        if (typeof windSpeedMs === 'number' && windSpeedMs < 3) {
          reasons.push({
            code: 'wind_below_cut_in',
            detail: `Wind speed is ${windSpeedMs.toFixed(1)} m/s, below the 3 m/s cut-in speed, so turbines produce nothing.`,
            impact: 'high',
          });
        } else if (typeof windSpeedMs === 'number' && windSpeedMs < 6) {
          reasons.push({
            code: 'low_wind_speed',
            detail: `Wind speed is ${windSpeedMs.toFixed(1)} m/s, well below the 12 m/s rated speed.`,
            impact: 'medium',
          });
        }
        if (typeof windSpeedMs === 'number' && windSpeedMs > 25) {
          reasons.push({
            code: 'wind_cut_out',
            detail: `Wind speed is ${windSpeedMs.toFixed(1)} m/s, above the 25 m/s cut-out speed — turbines shut down for safety.`,
            impact: 'high',
          });
        }
        if (typeof turbulenceIndex === 'number' && turbulenceIndex > 0.3) {
          reasons.push({
            code: 'high_turbulence',
            detail: `Turbulence index of ${turbulenceIndex.toFixed(2)} makes output unstable and harder to predict.`,
            impact: 'low',
          });
        }
      } else if (classification === 'higher') {
        if (typeof windSpeedMs === 'number' && windSpeedMs >= 12) {
          reasons.push({
            code: 'strong_wind',
            detail: `Wind speed is ${windSpeedMs.toFixed(1)} m/s, at or above rated speed — turbines are at full output.`,
            impact: 'medium',
          });
        }
      }
    }
  } else {
    reasons.push({
      code: 'no_weather_snapshot',
      detail: 'No weather snapshot is stored for this plant, so meteorological causes cannot be attributed.',
      impact: 'low',
    });
  }

  if (classification === 'lower' && !reasons.length) {
    reasons.push({
      code: 'unexplained_deviation',
      detail: 'Generation is below forecast, but no sensor fault or adverse weather condition explains it. Worth a manual inspection.',
      impact: 'medium',
    });
  }

  return reasons;
}

/**
 * Evaluate a plant's current generation against the latest AI forecast.
 *
 * Combines the three real data sources already stored for the plant: the most
 * recent SCADA telemetry reading, the latest cron-generated forecast, and the
 * latest reconciled weather snapshot.
 *
 * @param {object} plant - Plant document (lean)
 * @returns {Promise<object>} Performance evaluation
 */
async function evaluatePlantPerformance(plant) {
  const plantId = plant._id;

  const [latest, forecast, snapshot] = await Promise.all([
    Telemetry.findOne({ plantId }).sort({ timestamp: -1 }).lean(),
    ForecastResult.findOne({ plantId }).sort({ generatedAt: -1 }).lean(),
    WeatherSnapshot.findOne({ plantId, observed: { $ne: true } }).sort({ generatedAt: -1 }).lean(),
  ]);

  const referenceTime = latest?.timestamp ? new Date(latest.timestamp) : new Date();
  const forecastPoint = forecast ? nearestByTime(forecast.points || [], referenceTime) : null;
  const weatherHour = snapshot ? nearestByTime(snapshot.hourly || [], referenceTime) : null;

  const actualMW = typeof latest?.generationMW === 'number' ? latest.generationMW : null;
  const expectedMW = typeof forecastPoint?.expectedMW === 'number' ? forecastPoint.expectedMW : null;

  let deltaMW = null;
  let deltaPct = null;
  if (actualMW !== null && expectedMW !== null) {
    deltaMW = actualMW - expectedMW;
    if (Math.abs(expectedMW) < ZERO_MW_EPSILON) {
      // Forecast says ~zero output (e.g. solar at night): only a real reading counts as a deviation.
      deltaPct = Math.abs(actualMW) < ZERO_MW_EPSILON ? 0 : 100;
    } else {
      deltaPct = (deltaMW / expectedMW) * 100;
    }
  }

  const hasBaseline = expectedMW !== null && actualMW !== null;
  const classification = hasBaseline ? classify(deltaPct) : 'unknown';
  const reasons = deriveReasons({
    plant, latest, weatherHour, classification, hasBaseline, expectedMW, actualMW,
  });

  return {
    plantId: plantId.toString(),
    plantName: plant.name,
    plantType: plant.type,
    capacityMW: plant.capacityMW,
    evaluatedAt: new Date(),
    measuredAt: latest?.timestamp || null,
    actualMW,
    expectedMW,
    deltaMW: deltaMW === null ? null : Number(deltaMW.toFixed(2)),
    deltaPct: deltaPct === null ? null : Number(deltaPct.toFixed(1)),
    capacityFactorPct:
      actualMW !== null && plant.capacityMW
        ? Number(((actualMW / plant.capacityMW) * 100).toFixed(1))
        : null,
    classification,
    confidencePct: forecastPoint?.confidencePct ?? null,
    underperforming: classification === 'lower',
    reasons,
    sensorStatus: latest?.sensorStatus || null,
    outage: latest?.outage ?? null,
    forecastGeneratedAt: forecast?.generatedAt || null,
    forecastHorizonHours: forecast?.horizonHours || null,
    weatherSnapshotAt: snapshot?.generatedAt || null,
    weather: weatherHour || null,
    weatherImpliedMW: (() => {
      const implied = weatherImpliedMW(plant, weatherHour);
      return implied === null ? null : Number(implied.toFixed(2));
    })(),
    usualBandPct: USUAL_BAND_PCT,
  };
}

module.exports = {
  evaluatePlantPerformance,
  classify,
  nearestByTime,
  weatherImpliedMW,
  USUAL_BAND_PCT,
};
