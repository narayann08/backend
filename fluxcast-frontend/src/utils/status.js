/**
 * Shared vocabulary for the two enums the UI colour-codes everywhere:
 * generation status vs forecast, and alert severity. Keeping the Tailwind
 * classes here means the map, cards and panels can never drift apart.
 */

export const STATUS_STYLES = {
  lower: {
    label: 'Below forecast',
    short: 'Lower',
    text: 'text-status-lower',
    bg: 'bg-status-lower-soft',
    border: 'border-status-lower/30',
    dot: 'bg-status-lower',
    hex: '#dc2626',
  },
  usual: {
    label: 'As forecast',
    short: 'Usual',
    text: 'text-status-usual',
    bg: 'bg-status-usual-soft',
    border: 'border-status-usual/30',
    dot: 'bg-status-usual',
    hex: '#059669',
  },
  higher: {
    label: 'Above forecast',
    short: 'Higher',
    text: 'text-status-higher',
    bg: 'bg-status-higher-soft',
    border: 'border-status-higher/30',
    dot: 'bg-status-higher',
    hex: '#7c3aed',
  },
  unknown: {
    label: 'No baseline',
    short: 'Unknown',
    text: 'text-status-unknown',
    bg: 'bg-status-unknown-soft',
    border: 'border-status-unknown/30',
    dot: 'bg-status-unknown',
    hex: '#64748b',
  },
};

export function statusStyle(classification) {
  return STATUS_STYLES[classification] || STATUS_STYLES.unknown;
}

export const SEVERITY_STYLES = {
  high: {
    label: 'High',
    text: 'text-severity-high',
    bg: 'bg-severity-high-soft',
    border: 'border-severity-high/30',
    dot: 'bg-severity-high',
    rank: 3,
  },
  medium: {
    label: 'Medium',
    text: 'text-severity-medium',
    bg: 'bg-severity-medium-soft',
    border: 'border-severity-medium/30',
    dot: 'bg-severity-medium',
    rank: 2,
  },
  low: {
    label: 'Low',
    text: 'text-severity-low',
    bg: 'bg-severity-low-soft',
    border: 'border-severity-low/30',
    dot: 'bg-severity-low',
    rank: 1,
  },
};

export function severityStyle(severity) {
  return SEVERITY_STYLES[severity] || SEVERITY_STYLES.low;
}

/** Weather `condition` values the backend can return, with map overlay tints. */
export const WEATHER_CONDITIONS = {
  clear:         { label: 'Clear',         overlay: 'rgba(250, 204, 21, 0.16)', ring: '#facc15' },
  partly_cloudy: { label: 'Partly cloudy', overlay: 'rgba(148, 163, 184, 0.18)', ring: '#94a3b8' },
  cloudy:        { label: 'Overcast',      overlay: 'rgba(100, 116, 139, 0.26)', ring: '#64748b' },
  rain:          { label: 'Rain likely',   overlay: 'rgba(56, 132, 255, 0.24)', ring: '#3b82f6' },
  windy:         { label: 'High wind',     overlay: 'rgba(14, 165, 233, 0.22)', ring: '#0ea5e9' },
  hot:           { label: 'Extreme heat',  overlay: 'rgba(249, 115, 22, 0.22)', ring: '#f97316' },
  unknown:       { label: 'No weather data', overlay: 'rgba(148, 163, 184, 0.12)', ring: '#cbd5e1' },
};

export function weatherCondition(condition) {
  return WEATHER_CONDITIONS[condition] || WEATHER_CONDITIONS.unknown;
}

/** Impact ordering for underperformance reasons, so the worst shows first. */
export const IMPACT_RANK = { high: 3, medium: 2, low: 1 };

export function sortByImpact(reasons = []) {
  return [...reasons].sort(
    (a, b) => (IMPACT_RANK[b.impact] || 0) - (IMPACT_RANK[a.impact] || 0),
  );
}
