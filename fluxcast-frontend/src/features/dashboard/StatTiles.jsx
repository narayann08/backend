import { Activity, CloudSun, Gauge, Target } from 'lucide-react';

import { StatusBadge } from '../../components/StatusBadge';
import { Skeleton } from '../../components/States';
import { formatMW, formatPct, formatRelative } from '../../utils/format';
import { weatherCondition } from '../../utils/status';

function Tile({ icon: Icon, label, value, hint, children, loading, valueClassName = 'text-2xl' }) {
  return (
    <div className="fc-ticks relative rounded-[3px] border border-line bg-surface-raised p-4 shadow-[0_18px_44px_-36px_rgb(15_23_42/0.5)]">
      <div className="fc-label mb-3 flex items-center gap-2 text-ink-muted">
        <Icon className="size-3.5 shrink-0" aria-hidden="true" />
        {label}
      </div>
      {loading ? (
        <Skeleton className="h-7 w-24" />
      ) : (
        <p className={`font-mono leading-tight text-ink ${valueClassName}`}>{value}</p>
      )}
      {children}
      {hint && !loading && <p className="mt-2 text-xs text-ink-muted">{hint}</p>}
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
          <div className="mt-2.5">
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
        valueClassName="text-lg"
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
