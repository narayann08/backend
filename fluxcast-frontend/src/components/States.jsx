import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react';

/**
 * The three async states every view needs: loading, error, empty.
 * Centralised so no screen quietly renders a blank box.
 */

/** Grey placeholder block sized by the caller. */
export function Skeleton({ className = 'h-4 w-full' }) {
  return <div className={`animate-soft-pulse rounded bg-line ${className}`} aria-hidden="true" />;
}

/** Skeleton stand-in for a list of rows. */
export function SkeletonList({ rows = 3, className = '' }) {
  return (
    <div className={`space-y-3 ${className}`} role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-2 rounded-lg border border-line p-3">
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

/**
 * Failure state with a retry affordance. `error` is the normalised Error from
 * the axios interceptor, so `message` is always operator-readable.
 */
export function ErrorState({ error, onRetry, title = 'Could not load this data', compact = false }) {
  return (
    <div
      role="alert"
      className={`flex flex-col items-start gap-2 rounded-lg border border-severity-high/30 bg-severity-high-soft ${compact ? 'p-3' : 'p-4'}`}
    >
      <div className="flex items-center gap-2 text-severity-high">
        <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
        <p className="text-sm font-semibold">{title}</p>
      </div>
      <p className="text-sm text-ink">{error?.message || 'Unexpected error.'}</p>
      {error?.detail && <p className="text-xs text-ink-muted">{error.detail}</p>}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-severity-high/40 bg-surface-raised px-2.5 py-1.5 text-xs font-medium text-severity-high hover:bg-severity-high-soft"
        >
          <RefreshCw className="size-3.5" aria-hidden="true" />
          Try again
        </button>
      )}
    </div>
  );
}

/** Neutral "nothing here" state — distinct from an error. */
export function EmptyState({ title, description, icon: Icon = Inbox, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-center">
      <Icon className="size-7 text-ink-muted/60" aria-hidden="true" />
      <p className="text-sm font-medium text-ink">{title}</p>
      {description && <p className="max-w-sm text-xs text-ink-muted">{description}</p>}
      {action}
    </div>
  );
}
