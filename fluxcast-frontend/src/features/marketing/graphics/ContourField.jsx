/*
 * Isobar field — the background weather this whole product is reacting to.
 *
 * Generated rather than drawn: each line is two summed sines, so the family
 * drifts and bunches the way pressure contours do instead of looking like a
 * stack of identical waves. Deterministic, so it never shifts between builds.
 */

const W = 1200;
const H = 520;
const COUNT = 15;
const STEP = 24;

function smooth(points) {
  let d = `M ${points[0][0]} ${points[0][1].toFixed(1)}`;
  for (let i = 1; i < points.length - 1; i += 1) {
    const [cx, cy] = points[i];
    const [nx, ny] = points[i + 1];
    d += ` Q ${cx} ${cy.toFixed(1)} ${(cx + nx) / 2} ${((cy + ny) / 2).toFixed(1)}`;
  }
  const [lx, ly] = points[points.length - 1];
  return `${d} L ${lx} ${ly.toFixed(1)}`;
}

const LINES = Array.from({ length: COUNT }, (_, i) => {
  const t = i / (COUNT - 1);
  const base = -20 + t * (H + 40);
  // Amplitude swells mid-field so the bunching reads as a front passing through.
  const amp = 22 + Math.sin(t * Math.PI) * 44;
  const wavelength = 330 + t * 150;
  const phase = t * 2.6;

  const points = [];
  for (let x = -60; x <= W + 60; x += STEP) {
    const a = Math.sin((x / wavelength) * Math.PI * 2 + phase);
    const b = Math.sin((x / (wavelength * 0.42)) * Math.PI * 2 + phase * 1.8);
    points.push([x, base + amp * a + amp * 0.3 * b]);
  }
  return { d: smooth(points), t };
});

export default function ContourField({ className = '' }) {
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {LINES.map((line) => (
        <path
          key={line.d}
          d={line.d}
          fill="none"
          stroke="currentColor"
          strokeWidth={line.t > 0.42 && line.t < 0.62 ? 1.1 : 0.7}
          /* Centre lines sit closest to the eye, so they carry the most ink. */
          opacity={0.1 + Math.sin(line.t * Math.PI) * 0.24}
        />
      ))}
    </svg>
  );
}
