import MockCard from '../components/MockCard';
import { FORECAST_POINTS, NOW_HOUR, hourToX, toBandPath, toLinePath } from './forecastSeries';

/*
 * The page's central visual: an illustrative forecast and its uncertainty
 * band. Hand-authored SVG rather than Recharts on purpose — the landing page
 * is imported eagerly, and pulling a charting library into the entry chunk
 * would undo the code-splitting the console relies on.
 *
 * Each size projects the same series into its own box rather than scaling one
 * drawing with CSS: a viewBox stretched to the card's width decides its height
 * too, and the mini card has to sit level with the alert card beside it.
 */

const OBSERVED = FORECAST_POINTS.slice(0, NOW_HOUR + 1);
const PREDICTED = FORECAST_POINTS.slice(NOW_HOUR);

function project({ width, height, box, axisY }) {
  return {
    width,
    height,
    axisY,
    box,
    band: toBandPath(PREDICTED, box),
    observed: toLinePath(OBSERVED, box),
    predicted: toLinePath(PREDICTED, box),
    nowX: hourToX(NOW_HOUR, box),
    nowY: box.y1 - FORECAST_POINTS[NOW_HOUR].v * (box.y1 - box.y0),
    grid: [0.25, 0.5, 0.75].map((t) => box.y1 - t * (box.y1 - box.y0)),
  };
}

const SIZES = {
  hero: project({ width: 320, height: 138, box: { x0: 6, y0: 14, x1: 314, y1: 116 }, axisY: 133 }),
  mini: project({ width: 560, height: 124, box: { x0: 8, y0: 10, x1: 552, y1: 118 } }),
};

/* The claim under the plot, stated as instrument facts: this curve belongs to
   one site, not a region. */
const SITE_FACTS = [
  ['Site', '27.53°N 71.91°E'],
  ['Capacity', '245 MW'],
  ['Tilt', '25°'],
];

export default function ForecastCardGraphic({ size = 'hero', className = '' }) {
  const isHero = size === 'hero';
  const plot = SIZES[size] || SIZES.hero;

  return (
    <MockCard
      className={className}
      label={isHero ? 'Bhadla Solar Park · Block IV' : 'Forecast · 24h'}
      caption={isHero ? 'Live' : 'Bhadla IV'}
    >
      <svg
        viewBox={`0 0 ${plot.width} ${plot.height}`}
        className="w-full"
        role="img"
        aria-label="Illustrative FluxCast forecast: expected generation rising to a midday peak, with an uncertainty range that widens further into the future."
      >
        {plot.grid.map((y) => (
          <line
            key={y}
            x1={plot.box.x0}
            x2={plot.box.x1}
            y1={y}
            y2={y}
            stroke="currentColor"
            strokeWidth="1"
            strokeDasharray="2 4"
            className="text-mkt-line"
          />
        ))}

        {/* One group so the band, both traces and the marker draw as a unit. */}
        <g className="mkt-plot">
          <path d={plot.band} className="fill-mkt-signal/15" />

          <path
            d={plot.observed}
            fill="none"
            strokeWidth="2"
            strokeLinecap="round"
            className="stroke-mkt-signal"
          />
          <path
            d={plot.predicted}
            fill="none"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray="4 4"
            className="stroke-mkt-signal/85"
          />

          <line
            x1={plot.nowX}
            x2={plot.nowX}
            y1={plot.box.y0 - 6}
            y2={plot.box.y1}
            strokeWidth="1"
            strokeDasharray="2 3"
            className="stroke-mkt-solar/70"
          />
          <circle cx={plot.nowX} cy={plot.nowY} r="6" className="mkt-blip fill-mkt-signal/30" />
          <circle cx={plot.nowX} cy={plot.nowY} r="2.75" className="fill-mkt-signal" />
        </g>

        {isHero && (
          <g className="mkt-mono fill-mkt-dim text-[10px]">
            <text x={plot.box.x0} y={plot.axisY}>
              00:00
            </text>
            <text x={plot.nowX} y={plot.axisY} textAnchor="middle" className="fill-mkt-solar">
              NOW
            </text>
            <text x={plot.box.x1} y={plot.axisY} textAnchor="end">
              24:00
            </text>
          </g>
        )}
      </svg>

      {!isHero && (
        <div className="mkt-mono relative mt-2.5 h-4 text-[11px] tracking-[0.08em] text-mkt-dim">
          <span className="absolute left-0">00:00</span>
          <span
            className="absolute -translate-x-1/2 text-mkt-solar"
            style={{ left: `${((plot.nowX / plot.width) * 100).toFixed(2)}%` }}
          >
            NOW
          </span>
          <span className="absolute right-0">24:00</span>
        </div>
      )}

      {!isHero && (
        <dl className="mkt-mono mt-4 flex flex-wrap gap-x-7 gap-y-2 border-t border-mkt-line pt-3.5 text-[11px] tracking-[0.1em] uppercase">
          {SITE_FACTS.map(([term, value]) => (
            <div key={term} className="flex items-baseline gap-2">
              <dt className="text-mkt-dim">{term}</dt>
              <dd className="text-mkt-ink-soft">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </MockCard>
  );
}
