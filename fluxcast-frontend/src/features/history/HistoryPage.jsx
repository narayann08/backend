import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { LineChart as LineChartIcon, Gauge, Info } from 'lucide-react';

import Card from '../../components/Card';
import ErrorBoundary from '../../components/ErrorBoundary';
import { EmptyState, ErrorState, Skeleton } from '../../components/States';
import { useHistory } from '../../hooks/useForecast';
import DateRangePicker from './DateRangePicker';
import { rangeFromPreset } from './ranges';
import ForecastVsActualChart from './ForecastVsActualChart';
import ConfidenceChart from './ConfidenceChart';
import { formatMW, formatPct } from '../../utils/format';

/** Stable reference so the memos below do not see a new array every render. */
const NO_POINTS = [];

function SummaryStat({ label, value, hint }) {
  return (
    <div className="fc-ticks relative rounded-[3px] border border-line bg-surface-raised p-4">
      <p className="fc-label text-ink-muted">{label}</p>
      <p className="mt-2.5 font-mono text-xl leading-none text-ink">{value}</p>
      {hint && <p className="mt-2 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}

/**
 * Plant history (plan §5).
 *
 * A single date range drives both charts; React Query caches per range, so
 * switching between presets is instant after the first load.
 */
export default function HistoryPage() {
  const { plantId } = useParams();
  const [preset, setPreset] = useState('7d');
  const [range, setRange] = useState(() => rangeFromPreset(168));

  const { data, isLoading, isFetching, isError, error, refetch } = useHistory(
    plantId,
    range.from,
    range.to,
  );

  const points = data?.points ?? NO_POINTS;
  const summary = data?.summary;

  // Hours where the model actually had something to be measured against.
  const forecastHours = useMemo(
    () => points.filter((p) => p.forecastMW !== null && p.forecastMW !== undefined).length,
    [points],
  );
  /*
   * Forecasts look forward while telemetry looks back, so on a young install
   * only the newest hours carry both. Flag thin coverage as well as none at
   * all — otherwise a two-hour sliver of forecast reads as a broken chart.
   */
  const forecastCoverageIsThin = points.length > 0 && forecastHours < points.length * 0.2;
  const hasConfidenceSeries = useMemo(
    () => points.some((p) => p.confidencePct !== null && p.confidencePct !== undefined),
    [points],
  );

  function handlePreset(option) {
    setPreset(option.key);
    setRange(rangeFromPreset(option.hours));
  }

  function handleCustom(nextRange) {
    setPreset('custom');
    setRange(nextRange);
  }

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <header className="border-b border-line pb-4">
        <p className="fc-label text-brand-dark">Recorded performance</p>
        <h1 className="fc-title mt-2 text-3xl text-ink">Plant history</h1>
        <p className="mt-1 text-sm text-ink-muted">
          How past forecasts compared with what the plant actually generated
        </p>
      </header>

      <DateRangePicker
        preset={preset}
        range={range}
        onPresetChange={handlePreset}
        onCustomChange={handleCustom}
      />

      {isError && <ErrorState error={error} onRetry={refetch} title="Could not load history" />}

      {!isError && (
        <>
          {/* Accuracy summary */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-[3px] border border-line bg-surface-raised p-4">
                  <Skeleton className="mb-3 h-3 w-20" />
                  <Skeleton className="h-6 w-16" />
                </div>
              ))
            ) : (
              <>
                <SummaryStat
                  label="Energy generated"
                  value={
                    summary?.actualTotalMWh !== null && summary?.actualTotalMWh !== undefined
                      ? `${summary.actualTotalMWh} MWh`
                      : '—'
                  }
                  hint={`${summary?.hours ?? 0} hours in range`}
                />
                <SummaryStat label="Peak output" value={formatMW(summary?.peakActualMW)} />
                <SummaryStat
                  label="Mean absolute error"
                  value={formatMW(summary?.maeMW)}
                  hint={
                    summary?.pairedHours
                      ? `across ${summary.pairedHours} compared hour${summary.pairedHours === 1 ? '' : 's'}`
                      : 'no compared hours yet'
                  }
                />
                <SummaryStat
                  label="Avg confidence"
                  value={formatPct(summary?.avgConfidencePct)}
                  hint={
                    summary?.mapePct !== null && summary?.mapePct !== undefined
                      ? `MAPE ${formatPct(summary.mapePct)}`
                      : undefined
                  }
                />
              </>
            )}
          </div>

          {/* Forecast vs actual */}
          <Card
            title="Forecast vs actual generation"
            subtitle="Hourly, in megawatts"
            icon={LineChartIcon}
            actions={
              isFetching && !isLoading ? (
                <span className="fc-label text-ink-muted">Updating…</span>
              ) : null
            }
          >
            <p className="mb-3 text-xs text-ink-muted">
              The solid line is what the plant actually generated; the dashed line is what the AI
              predicted for that hour, using only forecasts issued <em>before</em> the hour began.
              The shaded band is the forecast&apos;s uncertainty range. Where the solid line sits
              below the dashed one, the plant underperformed its prediction.
            </p>

            <ErrorBoundary title="The forecast chart failed to render">
              {isLoading ? (
                <Skeleton className="h-[320px] w-full" />
              ) : points.length === 0 ? (
                <EmptyState
                  icon={LineChartIcon}
                  title="No data in this range"
                  description="Pick a wider date range, or run the backend's telemetry catch-up script to populate readings."
                />
              ) : (
                <>
                  <ForecastVsActualChart points={points} />
                  {forecastCoverageIsThin && (
                    <p className="mt-3 flex items-start gap-2 rounded-[3px] border border-severity-medium/35 bg-severity-medium-soft p-3 text-xs text-ink">
                      <Info
                        className="mt-0.5 size-3.5 shrink-0 text-severity-medium"
                        aria-hidden="true"
                      />
                      {forecastHours === 0
                        ? 'Only measured output is plotted for this range.'
                        : `Only ${forecastHours} of ${points.length} hours in this range have a forecast to compare against, so the forecast line covers a small slice of the chart.`}{' '}
                      Forecasts look forward, so the overlay fills in as the forecast job
                      keeps running and its predictions age into the window.
                    </p>
                  )}
                </>
              )}
            </ErrorBoundary>
          </Card>

          {/* Confidence */}
          <Card
            title="Prediction confidence over time"
            subtitle="How sure the model was, hour by hour"
            icon={Gauge}
          >
            <p className="mb-3 text-xs text-ink-muted">
              Confidence the forecasting agent attached to each hour it predicted. Sustained values
              near or below 50% mean the model was working with degraded sensor data or thin history
              — treat those forecasts with more caution.
            </p>

            <ErrorBoundary title="The confidence chart failed to render">
              {isLoading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : !hasConfidenceSeries ? (
                <EmptyState
                  icon={Gauge}
                  title="No confidence data in this range"
                  description="Confidence is recorded with each forecast, so this fills in as forecasts age into the selected window."
                />
              ) : (
                <ConfidenceChart points={points} />
              )}
            </ErrorBoundary>
          </Card>
        </>
      )}
    </div>
  );
}
