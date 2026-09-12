import { useParams } from 'react-router-dom';
import { Map as MapIcon, RefreshCw } from 'lucide-react';

import Card from '../../components/Card';
import ErrorBoundary from '../../components/ErrorBoundary';
import { ErrorState, Skeleton } from '../../components/States';
import { useLiveGeneration, usePerformance, usePlant } from '../../hooks/usePlants';
import { useForecast, useWeather } from '../../hooks/useForecast';
import PlantMap from './PlantMap';
import AlertsPanel from './AlertsPanel';
import AiDecisionCard from './AiDecisionCard';
import StatTiles from './StatTiles';
import { formatMW, formatRelative, formatSignedPct } from '../../utils/format';
import { statusStyle, sortByImpact } from '../../utils/status';

/**
 * Plant dashboard (plan §4).
 *
 * Layout: stat tiles across the top, map filling the main column, alerts and
 * the AI decision card stacked on the right.
 */
export default function DashboardPage() {
  const { plantId } = useParams();

  const plantQuery = usePlant(plantId);
  const liveQuery = useLiveGeneration(plantId);
  const performanceQuery = usePerformance(plantId);
  const forecastQuery = useForecast(plantId, 24);
  const weatherQuery = useWeather(plantId);

  const plant = plantQuery.data;
  const live = liveQuery.data;
  const performance = performanceQuery.data;

  // A plant with no telemetry 404s on /generation/live — a real state, not a bug.
  const noTelemetry = liveQuery.error?.status === 404;

  const isLoadingHeadline =
    plantQuery.isLoading || liveQuery.isLoading || performanceQuery.isLoading;

  if (plantQuery.isError) {
    return (
      <div className="p-4 sm:p-6">
        <ErrorState
          error={plantQuery.error}
          onRetry={plantQuery.refetch}
          title="Could not load this plant"
        />
      </div>
    );
  }

  const style = statusStyle(performance?.classification);
  const topReasons = sortByImpact(performance?.reasons || []).slice(0, 2);

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4">
        <div>
          <p className="fc-label text-brand-dark">Live operations</p>
          <h1 className="fc-title mt-2 text-3xl text-ink">
            {plant?.name || <Skeleton className="h-8 w-48" />}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Live generation, conditions and grid decisions
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            liveQuery.refetch();
            performanceQuery.refetch();
            weatherQuery.refetch();
            forecastQuery.refetch();
          }}
          className="fc-label inline-flex items-center gap-2 rounded-[2px] border border-line bg-surface-raised px-3 py-2 text-ink-muted transition-colors hover:border-brand/50 hover:text-brand-dark"
        >
          <RefreshCw
            className={`size-3.5 ${liveQuery.isFetching ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
          Refresh
        </button>
      </header>

      {noTelemetry && (
        <div className="rounded-[3px] border border-severity-medium/35 bg-severity-medium-soft p-3 text-sm text-ink">
          No telemetry has been recorded for this plant yet, so live output and the forecast
          comparison are unavailable. Run{' '}
          <code className="rounded-[2px] bg-surface px-1 py-0.5 font-mono text-xs">
            npm run mock:telemetry:catchup
          </code>{' '}
          in the backend to populate readings.
        </div>
      )}

      <StatTiles
        live={live}
        performance={performance}
        weather={weatherQuery.data}
        isLoading={isLoadingHeadline}
      />

      <div className="grid min-h-0 gap-4 lg:grid-cols-3">
        {/* Map column */}
        <div className="flex min-h-0 flex-col gap-3 lg:col-span-2">
          <Card
            title="Site map"
            subtitle={
              weatherQuery.data
                ? `Overlay shows current conditions · ${weatherQuery.data.conditionLabel}`
                : 'Loading conditions…'
            }
            icon={MapIcon}
            bodyClassName="p-0"
            className="min-h-[24rem] flex-1 overflow-hidden"
          >
            <ErrorBoundary title="The map failed to render">
              <div className="h-full min-h-[24rem] w-full">
                {plant ? (
                  <PlantMap
                    plant={plant}
                    live={live}
                    performance={performance}
                    forecast={forecastQuery.data}
                    weather={weatherQuery.data}
                  />
                ) : (
                  <Skeleton className="h-full min-h-[24rem] w-full rounded-none" />
                )}
              </div>
            </ErrorBoundary>
          </Card>

          {/*
            Text equivalent of the map tooltip. The map is aria-hidden, so this
            is how the same information reaches screen readers — and it stays
            useful on touch devices, where there is no hover.
          */}
          {performance && (
            <div className="fc-ticks relative rounded-[3px] border border-line bg-surface-raised p-4 text-sm">
              <h2 className="fc-label mb-2 text-ink-muted">Site summary</h2>
              <p className="text-ink">
                {plant?.name} is generating{' '}
                <strong className="font-mono font-normal">{formatMW(performance.actualMW)}</strong>{' '}
                against a forecast of{' '}
                <strong className="font-mono font-normal">
                  {formatMW(performance.expectedMW)}
                </strong>{' '}
                —{' '}
                <span className={style.text}>
                  {style.label.toLowerCase()}
                  {performance.deltaPct !== null && performance.deltaPct !== undefined
                    ? ` (${formatSignedPct(performance.deltaPct)})`
                    : ''}
                </span>
                {performance.measuredAt
                  ? `, measured ${formatRelative(performance.measuredAt)}`
                  : ''}
                .
              </p>
              {topReasons.length > 0 && (
                <ul className="mt-2 space-y-1 text-ink-muted">
                  {topReasons.map((reason) => (
                    <li key={reason.code}>• {reason.detail}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Right rail */}
        <div className="flex min-h-0 flex-col gap-4">
          <ErrorBoundary title="The alerts panel failed">
            <AlertsPanel plantId={plantId} className="max-h-[28rem] min-h-[18rem]" />
          </ErrorBoundary>

          <ErrorBoundary title="The AI decision card failed">
            <AiDecisionCard
              plantId={plantId}
              performance={performance}
              performanceQuery={performanceQuery}
              className="max-h-[36rem]"
            />
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}
