import { useEffect, useMemo } from 'react';
import { Circle, MapContainer, Marker, TileLayer, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';

import { statusStyle, weatherCondition, sortByImpact } from '../../utils/status';
import { formatMW, formatPct, formatRelative, formatSignedPct } from '../../utils/format';

/**
 * Leaflet was chosen over Mapbox GL because it needs no API token or billing
 * account — see ASSUMPTIONS.md. OpenStreetMap tiles cover zoom-to-plant,
 * custom markers, hover popups and the weather overlay the plan asks for.
 */

const PLANT_ZOOM = 11;

/**
 * Build the plant marker as an inline SVG pin tinted by generation status, so
 * the marker itself communicates lower/usual/higher at a glance.
 */
function buildMarkerIcon(classification) {
  const { hex } = statusStyle(classification);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="34" height="46" viewBox="0 0 34 46">
      <path d="M17 45C17 45 32 27.5 32 16.5A15 15 0 1 0 2 16.5C2 27.5 17 45 17 45Z"
            fill="${hex}" stroke="white" stroke-width="2.5" stroke-linejoin="round"/>
      <circle cx="17" cy="16.5" r="5.5" fill="white"/>
    </svg>`;

  return L.divIcon({
    html: svg,
    className: 'fluxcast-marker',
    iconSize: [34, 46],
    iconAnchor: [17, 45],
    tooltipAnchor: [0, -38],
  });
}

/** Recentre when the selected plant changes (the map itself is never remounted). */
function RecenterOnPlant({ latitude, longitude }) {
  const map = useMap();
  useEffect(() => {
    if (typeof latitude === 'number' && typeof longitude === 'number') {
      map.setView([latitude, longitude], PLANT_ZOOM, { animate: true });
    }
  }, [map, latitude, longitude]);
  return null;
}

/**
 * Hover tooltip contents (plan §4.2): current generation, the next-24h
 * prediction, and — when output is below forecast — the attributed reasons.
 */
function TooltipBody({ plant, live, performance, forecast }) {
  const classification = performance?.classification ?? live?.classification;
  const style = statusStyle(classification);
  const reasons = sortByImpact(performance?.reasons || []).slice(0, 3);

  // Peak of the forecast curve is the most useful single "next 24h" number.
  const peak = useMemo(() => {
    const points = forecast?.points || [];
    if (!points.length) return null;
    return points.reduce(
      (best, p) => ((p.expectedMW ?? -Infinity) > (best.expectedMW ?? -Infinity) ? p : best),
      points[0],
    );
  }, [forecast]);

  return (
    <div className="w-64 space-y-2.5 text-xs">
      <div>
        <p className="text-sm font-semibold text-ink">{plant.name}</p>
        <p className="text-ink-muted">
          {plant.type === 'wind' ? 'Wind farm' : 'Solar park'} · {plant.capacityMW} MW capacity
        </p>
      </div>

      <div className="space-y-1 border-t border-line pt-2">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-ink-muted">Generating now</span>
          <span className="text-sm font-semibold text-ink">{formatMW(live?.generationMW)}</span>
        </div>
        {live?.timestamp && (
          <p className="text-right text-[11px] text-ink-muted">measured {formatRelative(live.timestamp)}</p>
        )}
        {live?.capacityFactorPct !== null && live?.capacityFactorPct !== undefined && (
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-ink-muted">Capacity factor</span>
            <span className="font-medium text-ink">{formatPct(live.capacityFactorPct)}</span>
          </div>
        )}
      </div>

      <div className="space-y-1 border-t border-line pt-2">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-ink-muted">Forecast for this hour</span>
          <span className="font-medium text-ink">{formatMW(performance?.expectedMW)}</span>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-ink-muted">Next 24h peak</span>
          <span className="font-medium text-ink">
            {peak ? formatMW(peak.expectedMW) : 'No forecast yet'}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-ink-muted">vs forecast</span>
          <span className={`font-semibold ${style.text}`}>
            {style.label}
            {performance?.deltaPct !== null && performance?.deltaPct !== undefined
              ? ` (${formatSignedPct(performance.deltaPct)})`
              : ''}
          </span>
        </div>
      </div>

      {reasons.length > 0 && (
        <div className="space-y-1 border-t border-line pt-2">
          {/* The same reason list explains a shortfall or an overshoot — label it accordingly. */}
          <p className={`font-semibold ${style.text}`}>
            {classification === 'lower' ? 'Why output is down' : 'Contributing factors'}
          </p>
          <ul className="space-y-1">
            {reasons.map((reason) => (
              <li key={reason.code} className="text-ink">
                • {reason.detail}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Dashboard map: zoomed to the plant, tinted by current weather, with a marker
 * whose hover tooltip carries the live generation picture.
 */
export default function PlantMap({ plant, live, performance, forecast, weather }) {
  const classification = performance?.classification ?? live?.classification ?? 'unknown';
  const icon = useMemo(() => buildMarkerIcon(classification), [classification]);
  const condition = weatherCondition(weather?.condition);

  if (typeof plant?.latitude !== 'number' || typeof plant?.longitude !== 'number') {
    return (
      <div className="grid h-full place-items-center p-6 text-sm text-ink-muted">
        This plant has no coordinates, so it cannot be mapped.
      </div>
    );
  }

  const position = [plant.latitude, plant.longitude];

  return (
    <MapContainer
      center={position}
      zoom={PLANT_ZOOM}
      scrollWheelZoom
      className="h-full w-full"
      // The map is decorative for screen readers; the same numbers are in the
      // stat cards and the accessible summary below the map.
      aria-hidden="true"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <RecenterOnPlant latitude={plant.latitude} longitude={plant.longitude} />

      {/* Weather overlay: a tinted radius around the site reflecting current conditions. */}
      <Circle
        center={position}
        radius={9000}
        pathOptions={{
          color: condition.ring,
          weight: 1.5,
          fillColor: condition.overlay,
          fillOpacity: 1,
        }}
      />

      <Marker position={position} icon={icon}>
        <Tooltip direction="top" opacity={1} className="fluxcast-tooltip">
          <TooltipBody
            plant={plant}
            live={live}
            performance={performance}
            forecast={forecast}
          />
        </Tooltip>
      </Marker>
    </MapContainer>
  );
}
