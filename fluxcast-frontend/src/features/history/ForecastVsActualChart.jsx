import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { formatDateTime, formatMW } from '../../utils/format';

/**
 * Recharts was chosen because the composable primitives make this chart
 * straightforward: an <Area> for the uncertainty band with two <Line>s over it,
 * and `connectNulls` to bridge the gaps that are inherent to this series —
 * hours often have an actual but no forecast, or the reverse.
 */

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="rounded-[3px] border border-line bg-surface-raised p-3 text-xs shadow-[0_18px_44px_-28px_rgb(15_23_42/0.6)]">
      <p className="fc-label mb-2 text-ink">{formatDateTime(label)}</p>
      <dl className="space-y-1 font-mono">
        <div className="flex items-center justify-between gap-4">
          <dt className="fc-label text-chart-actual">Actual</dt>
          <dd className="text-ink">{formatMW(point.actualMW)}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="fc-label text-chart-forecast">Forecast</dt>
          <dd className="text-ink">{formatMW(point.forecastMW)}</dd>
        </div>
        {point.forecastMW !== null && point.lowerBoundMW !== null && (
          <div className="flex items-center justify-between gap-4">
            <dt className="fc-label text-ink-muted">Range</dt>
            <dd className="text-ink-muted">
              {formatMW(point.lowerBoundMW)} – {formatMW(point.upperBoundMW)}
            </dd>
          </div>
        )}
        {point.errorMW !== null && point.errorMW !== undefined && (
          <div className="flex items-center justify-between gap-4 border-t border-line pt-1.5">
            <dt className="fc-label text-ink-muted">Error</dt>
            <dd className="text-ink">
              {point.errorMW > 0 ? '+' : ''}
              {formatMW(point.errorMW)}
            </dd>
          </div>
        )}
        {point.outage && <p className="fc-label mt-1 text-severity-high">Outage recorded</p>}
        {point.sensorDegraded && !point.outage && (
          <p className="fc-label mt-1 text-severity-medium">Sensor degraded</p>
        )}
      </dl>
    </div>
  );
}

export default function ForecastVsActualChart({ points }) {
  // Recharts needs the band as [low, high] pairs; null gaps are skipped.
  const data = points.map((p) => ({
    ...p,
    band:
      p.lowerBoundMW !== null && p.upperBoundMW !== null ? [p.lowerBoundMW, p.upperBoundMW] : null,
  }));

  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart data={data} margin={{ top: 8, right: 48, bottom: 8, left: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" vertical={false} />
        <XAxis
          dataKey="time"
          tickFormatter={formatDateTime}
          stroke="var(--color-ink-muted)"
          fontSize={11}
          fontFamily="var(--font-mono)"
          minTickGap={40}
        />
        <YAxis
          stroke="var(--color-ink-muted)"
          fontSize={11}
          fontFamily="var(--font-mono)"
          width={54}
          label={{
            value: 'MW',
            angle: -90,
            position: 'insideLeft',
            style: {
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              fill: 'var(--color-ink-muted)',
            },
          }}
        />
        <Tooltip content={<ChartTooltip />} />
        <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'var(--font-mono)' }} />

        <Area
          type="monotone"
          dataKey="band"
          name="Forecast range"
          stroke="none"
          fill="var(--color-chart-band)"
          fillOpacity={0.12}
          connectNulls
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="forecastMW"
          name="Forecast"
          stroke="var(--color-chart-forecast)"
          strokeWidth={2}
          strokeDasharray="5 4"
          dot={false}
          connectNulls
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="actualMW"
          name="Actual"
          stroke="var(--color-chart-actual)"
          strokeWidth={2}
          dot={false}
          connectNulls
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
