/*
 * Illustrative generation curve for the marketing graphics — one solar day,
 * normalised 0–1. Hand-tuned and frozen rather than generated, so the hero
 * renders identically across builds and screenshots.
 *
 * `spread` is the half-width of the uncertainty band. It stays near zero for
 * hours already observed and widens past NOW_HOUR, which is the honest shape:
 * confidence decays with horizon.
 */

export const NOW_HOUR = 13;

const CURVE = [
  0, 0, 0, 0, 0, 0.01, 0.06, 0.19, 0.35, 0.53, 0.68, 0.81, 0.9, 0.94, 0.87, 0.75, 0.59, 0.41, 0.23,
  0.08, 0.01, 0, 0, 0,
];

export const FORECAST_POINTS = CURVE.map((v, h) => {
  const horizon = Math.max(0, h - NOW_HOUR);
  const spread = horizon === 0 ? 0.015 : 0.02 + horizon * 0.012;
  return {
    h,
    v,
    lo: Math.max(0, v - spread),
    hi: Math.min(1, v + spread),
  };
});

/** Maps an hour/value pair into the SVG box. */
function project(point, box, key) {
  const { x0, y0, x1, y1 } = box;
  const lastHour = CURVE.length - 1;
  return [x0 + (point.h / lastHour) * (x1 - x0), y1 - point[key] * (y1 - y0)];
}

/*
 * Smooths with quadratic midpoints rather than straight segments — cheap, and
 * it keeps the curve readable at the mini size where points crowd together.
 */
function smooth(coords) {
  if (coords.length < 2) return '';
  let d = `M ${coords[0][0]} ${coords[0][1]}`;
  for (let i = 1; i < coords.length - 1; i += 1) {
    const [cx, cy] = coords[i];
    const [nx, ny] = coords[i + 1];
    d += ` Q ${cx} ${cy} ${(cx + nx) / 2} ${(cy + ny) / 2}`;
  }
  const [lx, ly] = coords[coords.length - 1];
  return `${d} L ${lx} ${ly}`;
}

export function toLinePath(points, box, key = 'v') {
  return smooth(points.map((p) => project(p, box, key)));
}

/*
 * Closed band: out along the upper bound, back along the lower one. Both edges
 * run through the same smoothing, so they curve identically and cannot pinch
 * against each other where the curve is steep.
 */
export function toBandPath(points, box) {
  const upper = smooth(points.map((p) => project(p, box, 'hi')));
  const lower = smooth(points.map((p) => project(p, box, 'lo')).reverse());
  return `${upper} L ${lower.slice(2)} Z`;
}

export function hourToX(hour, box) {
  return box.x0 + (hour / (CURVE.length - 1)) * (box.x1 - box.x0);
}
