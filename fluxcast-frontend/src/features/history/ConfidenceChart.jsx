import {
  Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

import { formatDateTime, formatPct } from '../../utils/format';

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const value = payload[0]?.value;
  if (value === null || value === undefined) return null;

  return (
    <div className="rounded-lg border border-line bg-surface-raised p-3 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-ink">{formatDateTime(label)}</p>
      <p className="text-ink">
        Confidence <span className="font-medium">{formatPct(value)}</span>
      </p>
    </div>
  );
}

/**
 * Prediction confidence over time (plan §5.3) — a separate visual from the
 * forecast-vs-actual chart so a dip in model certainty is readable on its own.
 * The 50% reference line marks where the agent's own fallback path sits.
 */
export default function ConfidenceChart({ points }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={points} margin={{ top: 8, right: 12, bottom: 8, left: 4 }}>
        <defs>
          <linearGradient id="confidenceFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-chart-confidence)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--color-chart-confidence)" stopOpacity={0.02} />
          </linearGradient>
        </defs>

        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" vertical={false} />
        <XAxis
          dataKey="time"
          tickFormatter={formatDateTime}
          stroke="var(--color-ink-muted)"
          fontSize={11}
          minTickGap={40}
        />
        <YAxis
          domain={[0, 100]}
          stroke="var(--color-ink-muted)"
          fontSize={11}
          width={54}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip content={<ChartTooltip />} />

        <ReferenceLine
          y={50}
          stroke="var(--color-severity-medium)"
          strokeDasharray="4 4"
          label={{
            value: 'Low confidence',
            position: 'insideTopLeft',
            style: { fontSize: 10, fill: 'var(--color-severity-medium)' },
          }}
        />

        <Area
          type="monotone"
          dataKey="confidencePct"
          name="Confidence"
          stroke="var(--color-chart-confidence)"
          strokeWidth={2}
          fill="url(#confidenceFill)"
          connectNulls
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
