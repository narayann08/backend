import { statusStyle, severityStyle } from '../utils/status';

/**
 * Chip showing a generation classification (lower/usual/higher) with its dot
 * colour. `showDelta` appends the percentage so the map tooltip and cards can
 * share one component.
 */
export function StatusBadge({ classification, deltaPct, size = 'sm', className = '' }) {
  const style = statusStyle(classification);
  const padding = size === 'lg' ? 'px-2.5 py-1.5 text-[12px]' : 'px-2 py-1';

  return (
    <span
      className={`fc-label inline-flex items-center gap-1.5 rounded-[2px] border ${style.bg} ${style.text} ${style.border} ${padding} ${className}`}
    >
      <span className={`size-1.5 rounded-full ${style.dot}`} aria-hidden="true" />
      {style.short}
      {deltaPct !== null && deltaPct !== undefined && (
        <span className="tracking-normal opacity-80">
          {deltaPct > 0 ? '+' : ''}
          {Number(deltaPct).toFixed(1)}%
        </span>
      )}
    </span>
  );
}

/** Chip for alert severity (high/medium/low). */
export function SeverityBadge({ severity, className = '' }) {
  const style = severityStyle(severity);
  return (
    <span
      className={`fc-label inline-flex items-center gap-1.5 rounded-[2px] border px-2 py-0.5 ${style.bg} ${style.text} ${style.border} ${className}`}
    >
      <span className={`size-1.5 rounded-full ${style.dot}`} aria-hidden="true" />
      {style.label}
    </span>
  );
}
