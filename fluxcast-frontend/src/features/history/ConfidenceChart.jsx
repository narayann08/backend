import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { formatDateTime, formatPct } from '../../utils/format';

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const value = payload[0]?.value;
  if (value === null || value === undefined) return null;

  return (
    <div className="rounded-[3px] border border-line bg-surface-raised p-3 text-xs shadow-[0_18px_44px_-28px_rgb(15_23_42/0.6)]">
      <p className="fc-label mb-1.5 text-ink">{formatDateTime(label)}</p>
      <p className="font-mono text-ink">
        Confidence <span className="text-chart-confidence">{formatPct(value)}</span>
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
      <AreaChart data={points} margin={{ top: 8, right: 48, bottom: 8, left: 4 }}>
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
          fontFamily="var(--font-mono)"
          minTickGap={40}
        />
        <YAxis
          domain={[0, 100]}
          stroke="var(--color-ink-muted)"
          fontSize={11}
          fontFamily="var(--font-mono)"
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
            style: {
              fontSize: 10,
              fontFamily: 'var(--font-mono)',
              fill: 'var(--color-severity-medium)',
            },
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
