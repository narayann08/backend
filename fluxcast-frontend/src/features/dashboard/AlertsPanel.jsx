import { useState } from 'react';
import { BellRing, Check, CheckCheck } from 'lucide-react';

import Card from '../../components/Card';
import { SeverityBadge } from '../../components/StatusBadge';
import { EmptyState, ErrorState, SkeletonList } from '../../components/States';
import { useAcknowledgeAlert, useAlerts } from '../../hooks/useAlerts';
import { formatRelative, humanise } from '../../utils/format';
import { severityStyle } from '../../utils/status';

/** "All" is client-side — the API has no severity=all (see API_CONTRACT.md). */
const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'high', label: 'High' },
  { key: 'medium', label: 'Medium' },
  { key: 'low', label: 'Low' },
];

function AlertRow({ alert, onAcknowledge, isAcknowledging }) {
  const style = severityStyle(alert.severity);

  return (
    <li className={`rounded-lg border p-3 ${style.border} ${alert.acknowledged ? 'bg-surface' : style.bg}`}>
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <SeverityBadge severity={alert.severity} />
        <time className="shrink-0 text-xs text-ink-muted" dateTime={alert.createdAt}>
          {formatRelative(alert.createdAt)}
        </time>
      </div>

      <p className="text-xs font-medium text-ink">{humanise(alert.type)}</p>
      <p className="mt-0.5 text-xs text-ink-muted">{alert.message}</p>

      <div className="mt-2 flex items-center justify-between gap-2">
        {alert.acknowledged ? (
          <span className="inline-flex items-center gap-1 text-xs text-status-usual">
            <CheckCheck className="size-3.5" aria-hidden="true" />
            Acknowledged
          </span>
        ) : (
          <button
            type="button"
            onClick={() => onAcknowledge(alert.id)}
            disabled={isAcknowledging}
            className="inline-flex items-center gap-1 rounded-md border border-line bg-surface-raised px-2 py-1 text-xs font-medium text-ink-muted transition hover:text-ink disabled:opacity-50"
          >
            <Check className="size-3.5" aria-hidden="true" />
            Acknowledge
          </button>
        )}
      </div>
    </li>
  );
}

/**
 * Right-hand alerts feed (plan §4.3).
 *
 * Near-real-time via the Socket.IO `new_alert` push opened in DashboardLayout,
 * with polling as the fallback.
 */
export default function AlertsPanel({ plantId, className = '' }) {
  const [filter, setFilter] = useState('all');
  const severity = filter === 'all' ? undefined : filter;

  const { data, isLoading, isError, error, refetch } = useAlerts({ plantId, severity });
  const acknowledge = useAcknowledgeAlert();

  const alerts = data ?? [];
  const unacknowledged = alerts.filter((a) => !a.acknowledged).length;

  return (
    <Card
      title="Alerts"
      subtitle={unacknowledged > 0 ? `${unacknowledged} needing attention` : 'All clear'}
      icon={BellRing}
      className={className}
      bodyClassName="flex min-h-0 flex-col p-0"
    >
      <div
        role="group"
        aria-label="Filter alerts by priority"
        className="flex shrink-0 gap-1 border-b border-line p-2"
      >
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            aria-pressed={filter === key}
            className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition ${
              filter === key
                ? 'bg-brand text-white'
                : 'text-ink-muted hover:bg-surface hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {isLoading && <SkeletonList rows={3} />}

        {isError && <ErrorState error={error} onRetry={refetch} title="Could not load alerts" compact />}

        {!isLoading && !isError && alerts.length === 0 && (
          <EmptyState
            icon={BellRing}
            title={filter === 'all' ? 'No alerts' : `No ${filter}-priority alerts`}
            description="Risk alerts raised by the forecasting pipeline will appear here."
          />
        )}

        {alerts.length > 0 && (
          <ul className="space-y-2">
            {alerts.map((alert) => (
              <AlertRow
                key={alert.id}
                alert={alert}
                onAcknowledge={acknowledge.mutate}
                isAcknowledging={acknowledge.isPending && acknowledge.variables === alert.id}
              />
            ))}
          </ul>
        )}

        {acknowledge.isError && (
          <div className="mt-2">
            <ErrorState error={acknowledge.error} title="Could not acknowledge" compact />
          </div>
        )}
      </div>
    </Card>
  );
}
