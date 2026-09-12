import { Activity, CloudSun, Gauge, Target } from 'lucide-react';

import { StatusBadge } from '../../components/StatusBadge';
import { Skeleton } from '../../components/States';
import { formatMW, formatPct, formatRelative } from '../../utils/format';
import { weatherCondition } from '../../utils/status';

function Tile({ icon: Icon, label, value, hint, children, loading }) {
  return (
    <div className="rounded-xl border border-line bg-surface-raised p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-ink-muted">
        <Icon className="size-3.5" aria-hidden="true" />
        {label}
      </div>
      {loading ? (
        <Skeleton className="h-6 w-24" />
      ) : (
        <p className="text-xl font-semibold text-ink">{value}</p>
      )}
      {children}
      {hint && !loading && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}

/**
 * The dashboard's headline numbers. These carry the same data the map tooltip
 * shows, in text form — which is what makes the map's visual-only information
 * available to screen readers and on small screens.
 */
export default function StatTiles({ live, performance, weather, isLoading }) {
  const condition = weatherCondition(weather?.condition);

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Tile
        icon={Activity}
        label="Generating now"
        value={formatMW(live?.generationMW)}
        hint={live?.timestamp ? `Measured ${formatRelative(live.timestamp)}` : undefined}
        loading={isLoading}
      />

      <Tile
        icon={Target}
        label="Forecast this hour"
        value={formatMW(performance?.expectedMW)}
        loading={isLoading}
      >
        {!isLoading && performance && (
          <div className="mt-1.5">
            <StatusBadge
              classification={performance.classification}
              deltaPct={performance.deltaPct}
            />
          </div>
        )}
      </Tile>

      <Tile
        icon={Gauge}
        label="Capacity factor"
        value={formatPct(live?.capacityFactorPct)}
        hint={live?.capacityMW ? `of ${live.capacityMW} MW installed` : undefined}
        loading={isLoading}
      />

      <Tile
        icon={CloudSun}
        label="Conditions"
        value={weather?.conditionLabel || condition.label}
        hint={
          weather?.current
            ? [
                weather.current.temperatureC != null &&
                  `${Math.round(weather.current.temperatureC)}°C`,
                weather.current.cloudCoverPct != null &&
                  `${Math.round(weather.current.cloudCoverPct)}% cloud`,
                weather.current.windSpeedMs != null &&
                  `${weather.current.windSpeedMs.toFixed(1)} m/s wind`,
              ]
                .filter(Boolean)
                .join(' · ')
            : undefined
        }
        loading={isLoading}
      />
    </div>
  );
}
