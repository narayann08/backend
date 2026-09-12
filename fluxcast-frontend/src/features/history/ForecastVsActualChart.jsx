import {
  Area, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
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
    <div className="rounded-lg border border-line bg-surface-raised p-3 text-xs shadow-lg">
      <p className="mb-1.5 font-semibold text-ink">{formatDateTime(label)}</p>
      <dl className="space-y-1">
        <div className="flex items-center justify-between gap-4">
          <dt className="text-chart-actual">Actual</dt>
          <dd className="font-medium text-ink">{formatMW(point.actualMW)}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-chart-forecast">Forecast</dt>
          <dd className="font-medium text-ink">{formatMW(point.forecastMW)}</dd>
        </div>
        {point.forecastMW !== null && point.lowerBoundMW !== null && (
          <div className="flex items-center justify-between gap-4">
            <dt className="text-ink-muted">Range</dt>
            <dd className="text-ink-muted">
              {formatMW(point.lowerBoundMW)} – {formatMW(point.upperBoundMW)}
            </dd>
          </div>
        )}
        {point.errorMW !== null && point.errorMW !== undefined && (
          <div className="flex items-center justify-between gap-4 border-t border-line pt-1">
            <dt className="text-ink-muted">Error</dt>
            <dd className="font-medium text-ink">
              {point.errorMW > 0 ? '+' : ''}
              {formatMW(point.errorMW)}
            </dd>
          </div>
        )}
        {point.outage && <p className="text-severity-high">Outage recorded</p>}
        {point.sensorDegraded && !point.outage && (
          <p className="text-severity-medium">Sensor degraded</p>
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
      p.lowerBoundMW !== null && p.upperBoundMW !== null
        ? [p.lowerBoundMW, p.upperBoundMW]
        : null,
  }));

  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 8, left: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" vertical={false} />
        <XAxis
          dataKey="time"
          tickFormatter={formatDateTime}
          stroke="var(--color-ink-muted)"
          fontSize={11}
          minTickGap={40}
        />
        <YAxis
          stroke="var(--color-ink-muted)"
          fontSize={11}
          width={54}
          label={{
            value: 'MW',
            angle: -90,
            position: 'insideLeft',
            style: { fontSize: 11, fill: 'var(--color-ink-muted)' },
          }}
        />
        <Tooltip content={<ChartTooltip />} />
        <Legend wrapperStyle={{ fontSize: 12 }} />

        <Area
          type="monotone"
          dataKey="band"
          name="Forecast range"
          stroke="none"
          fill="var(--color-chart-band)"
          fillOpacity={0.35}
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
