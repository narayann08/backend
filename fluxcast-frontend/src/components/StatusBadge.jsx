import { statusStyle, severityStyle } from '../utils/status';

/**
 * Pill showing a generation classification (lower/usual/higher) with its dot
 * colour. `showDelta` appends the percentage so the map tooltip and cards can
 * share one component.
 */
export function StatusBadge({ classification, deltaPct, size = 'sm', className = '' }) {
  const style = statusStyle(classification);
  const padding = size === 'lg' ? 'px-3 py-1.5 text-sm' : 'px-2 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${style.bg} ${style.text} ${style.border} ${padding} ${className}`}
    >
      <span className={`size-1.5 rounded-full ${style.dot}`} aria-hidden="true" />
      {style.short}
      {deltaPct !== null && deltaPct !== undefined && (
        <span className="font-normal opacity-80">
          {deltaPct > 0 ? '+' : ''}
          {Number(deltaPct).toFixed(1)}%
        </span>
      )}
    </span>
  );
}

/** Pill for alert severity (high/medium/low). */
export function SeverityBadge({ severity, className = '' }) {
  const style = severityStyle(severity);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${style.bg} ${style.text} ${style.border} ${className}`}
    >
      <span className={`size-1.5 rounded-full ${style.dot}`} aria-hidden="true" />
      {style.label}
    </span>
  );
}
