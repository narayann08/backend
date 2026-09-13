'use strict';

/**
 * The generation model: weather in, megawatts out.
 *
 * One module so the forecaster and the performance service can never disagree
 * about what a given hour of weather is worth — they used to carry separate
 * copies of these curves.
 *
 * Two corrections are baked in here against the curves this project started
 * with. Irradiance is not multiplied by a cloud factor: Open-Meteo's
 * shortwave_radiation is an all-sky figure that already has cloud in it, so
 * applying a second cloud term charged the plant for the same cloud twice.
 * And wind uses the cubic power curve between cut-in and rated rather than
 * `((v - 3) / 9)³`, which understates a mid-range wind by about half — at
 * 7.5 m/s the old form gives 12.5% of capacity where the real curve gives 23%.
 */

const SOLAR = {
  /** Fractional output lost per °C above the 25°C rating point. */
  TEMP_COEFF_PER_C: 0.004,
  RATING_TEMP_C: 25,
  /** Irradiance at which a panel delivers its nameplate rating. */
  STC_IRRADIANCE: 1000,
};

const WIND = {
  CUT_IN_MS: 3,
  RATED_MS: 12,
  CUT_OUT_MS: 25,
};

/** Least-squares fit is clamped here: beyond this a fit is a data fault, not a plant. */
const CALIBRATION_BOUNDS = { min: 0.25, max: 1.25 };
/** Below this many paired hours the fit is noise, so the model runs uncalibrated. */
const MIN_CALIBRATION_SAMPLES = 12;

/** Fallback band half-width when there is no residual history to size it from. */
const DEFAULT_BAND_PCT = 0.15;
/** Uncertainty grows with horizon: added per hour, on top of the fitted band. */
const BAND_GROWTH_PER_HOUR = 0.004;
const MAX_BAND_PCT = 0.6;

const CONFIDENCE = {
  MAX: 92,
  MIN: 25,
  /** Lost per hour of horizon — a 24h-out hour is less certain than the next one. */
  DECAY_PER_HOUR: 0.6,
  /** Penalty when the plant's own sensors were degraded in the calibration window. */
  DEGRADED_PENALTY: 20,
  /** Penalty when there was not enough history to calibrate against. */
  UNCALIBRATED_PENALTY: 15,
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const hourKey = (t) => {
  const d = new Date(t);
  d.setUTCMinutes(0, 0, 0);
  return d.toISOString();
};

/**
 * Output the weather alone implies for this plant, before calibration.
 *
 * @param {object} plant - Plant document with `type` and `capacityMW`
 * @param {object} weatherHour - One hourly weather entry
 * @returns {number|null} MW, or null when the driving variable is missing
 */
function impliedMW(plant, weatherHour) {
  if (!weatherHour || !plant?.capacityMW) return null;

  if (plant.type === 'solar') {
    const { ghiWm2, temperatureC } = weatherHour;
    if (typeof ghiWm2 !== 'number') return null;
    if (ghiWm2 <= 0) return 0;

    const tempFactor =
      typeof temperatureC === 'number'
        ? 1 - Math.max(0, temperatureC - SOLAR.RATING_TEMP_C) * SOLAR.TEMP_COEFF_PER_C
        : 1;

    return clamp(plant.capacityMW * (ghiWm2 / SOLAR.STC_IRRADIANCE) * tempFactor, 0, plant.capacityMW);
  }

  if (plant.type === 'wind') {
    const v = weatherHour.windSpeedMs;
    if (typeof v !== 'number') return null;
    if (v < WIND.CUT_IN_MS || v > WIND.CUT_OUT_MS) return 0;
    if (v >= WIND.RATED_MS) return plant.capacityMW;

    const cutIn3 = WIND.CUT_IN_MS ** 3;
    const rated3 = WIND.RATED_MS ** 3;
    return plant.capacityMW * ((v ** 3 - cutIn3) / (rated3 - cutIn3));
  }

  return null;
}

/**
 * Fit the plant's own history against what the weather implied for those same
 * hours. One scalar through the origin — the standing difference between
 * nameplate physics and what this specific site actually delivers (soiling,
 * wiring losses, array layout, terrain).
 *
 * @param {object} plant
 * @param {Array<{timestamp: Date, generationMW: number, sensorStatus?: string, outage?: boolean}>} telemetry
 * @param {Array<object>} weatherHourly - Weather covering the telemetry window
 * @returns {{factor: number, samples: number, bandPct: number, calibrated: boolean, degraded: boolean}}
 */
function calibrate(plant, telemetry = [], weatherHourly = []) {
  const weatherByHour = new Map();
  for (const hour of weatherHourly) {
    if (hour?.time) weatherByHour.set(hourKey(hour.time), hour);
  }

  const pairs = [];
  let degraded = false;

  for (const reading of telemetry) {
    if (reading?.outage) continue;
    if (reading?.sensorStatus && reading.sensorStatus !== 'ok') {
      degraded = true;
      continue; // a degraded sensor cannot calibrate anything
    }
    const weatherHour = weatherByHour.get(hourKey(reading.timestamp));
    if (!weatherHour) continue;

    const raw = impliedMW(plant, weatherHour);
    if (raw === null || typeof reading.generationMW !== 'number') continue;
    pairs.push({ raw, actual: reading.generationMW });
  }

  // Night and becalmed hours carry no signal about the scale factor.
  const usable = pairs.filter((p) => p.raw > 0);

  if (usable.length < MIN_CALIBRATION_SAMPLES) {
    return {
      factor: 1,
      samples: usable.length,
      bandPct: DEFAULT_BAND_PCT,
      calibrated: false,
      degraded,
    };
  }

  const numerator = usable.reduce((sum, p) => sum + p.raw * p.actual, 0);
  const denominator = usable.reduce((sum, p) => sum + p.raw * p.raw, 0);
  const factor = clamp(
    denominator > 0 ? numerator / denominator : 1,
    CALIBRATION_BOUNDS.min,
    CALIBRATION_BOUNDS.max
  );

  // Size the uncertainty band from the fit's own residuals rather than a
  // fixed ±15%: a site that tracks the weather closely earns a tighter band.
  const meanActual = usable.reduce((sum, p) => sum + p.actual, 0) / usable.length;
  const meanAbsError =
    usable.reduce((sum, p) => sum + Math.abs(p.actual - p.raw * factor), 0) / usable.length;
  const bandPct =
    meanActual > 0 ? clamp(meanAbsError / meanActual, 0.05, MAX_BAND_PCT) : DEFAULT_BAND_PCT;

  return {
    factor: Number(factor.toFixed(4)),
    samples: usable.length,
    bandPct: Number(bandPct.toFixed(4)),
    calibrated: true,
    degraded,
  };
}

/**
 * Turn an hourly weather series into forecast points.
 *
 * @param {object} params
 * @param {object} params.plant
 * @param {Array<object>} params.hourly - Reconciled weather, chronological
 * @param {object} params.calibration - Output of {@link calibrate}
 * @param {number} params.horizon - Hours to emit
 * @returns {Array<object>} Forecast points
 */
function buildForecastPoints({ plant, hourly = [], calibration, horizon = 24 }) {
  const cal = calibration || { factor: 1, bandPct: DEFAULT_BAND_PCT, calibrated: false, degraded: false };

  return hourly.slice(0, horizon).map((weatherHour, index) => {
    const raw = impliedMW(plant, weatherHour);
    const expected = raw === null ? 0 : clamp(raw * cal.factor, 0, plant.capacityMW);

    const bandPct = clamp(cal.bandPct + index * BAND_GROWTH_PER_HOUR, 0.05, MAX_BAND_PCT);

    let confidence = CONFIDENCE.MAX - index * CONFIDENCE.DECAY_PER_HOUR;
    if (!cal.calibrated) confidence -= CONFIDENCE.UNCALIBRATED_PENALTY;
    if (cal.degraded) confidence -= CONFIDENCE.DEGRADED_PENALTY;
    if (raw === null) confidence -= CONFIDENCE.DEGRADED_PENALTY; // weather variable missing

    return {
      time: new Date(weatherHour.time),
      expectedMW: Number(expected.toFixed(2)),
      lowerBoundMW: Number(Math.max(0, expected * (1 - bandPct)).toFixed(2)),
      upperBoundMW: Number(Math.min(plant.capacityMW, expected * (1 + bandPct)).toFixed(2)),
      confidencePct: Math.round(clamp(confidence, CONFIDENCE.MIN, CONFIDENCE.MAX)),
    };
  });
}

module.exports = {
  impliedMW,
  calibrate,
  buildForecastPoints,
  hourKey,
  clamp,
  SOLAR,
  WIND,
  CALIBRATION_BOUNDS,
  MIN_CALIBRATION_SAMPLES,
};
