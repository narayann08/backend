import { Lightbulb, BatteryCharging, BatteryLow, Scissors, Share2, Power, PauseCircle } from 'lucide-react';

import Card from '../../components/Card';
import { EmptyState, ErrorState, SkeletonList } from '../../components/States';
import { useRecommendations } from '../../hooks/useDecisions';
import { formatDateTime, formatMW, humanise } from '../../utils/format';

/** Each grid action gets an icon and tone so the board scans quickly. */
const ACTION_PRESENTATION = {
  charge_battery:    { icon: BatteryCharging, tone: 'text-status-usual',    bg: 'bg-status-usual-soft',    border: 'border-status-usual/30' },
  discharge_battery: { icon: BatteryLow,      tone: 'text-severity-medium', bg: 'bg-severity-medium-soft', border: 'border-severity-medium/30' },
  curtail:           { icon: Scissors,        tone: 'text-severity-high',   bg: 'bg-severity-high-soft',   border: 'border-severity-high/30' },
  export:            { icon: Share2,          tone: 'text-brand',           bg: 'bg-severity-low-soft',    border: 'border-brand/30' },
  activate_backup:   { icon: Power,           tone: 'text-status-higher',   bg: 'bg-status-higher-soft',   border: 'border-status-higher/30' },
  hold:              { icon: PauseCircle,     tone: 'text-ink-muted',       bg: 'bg-surface',              border: 'border-line' },
};

function RecommendationCard({ recommendation }) {
  const presentation = ACTION_PRESENTATION[recommendation.action] || ACTION_PRESENTATION.hold;
  const Icon = presentation.icon;

  return (
    <li className={`rounded-lg border p-4 ${presentation.border} ${presentation.bg}`}>
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className={`size-4 shrink-0 ${presentation.tone}`} aria-hidden="true" />
          <h3 className={`text-sm font-semibold ${presentation.tone}`}>
            {humanise(recommendation.action)}
          </h3>
        </div>
        <time className="shrink-0 text-xs text-ink-muted" dateTime={recommendation.generatedAt}>
          {formatDateTime(recommendation.generatedAt)}
        </time>
      </div>

      {(recommendation.amountMW || recommendation.durationHours) && (
        <p className="mb-1.5 text-xs font-medium text-ink">
          {recommendation.amountMW ? formatMW(recommendation.amountMW) : null}
          {recommendation.amountMW && recommendation.durationHours ? ' · ' : null}
          {recommendation.durationHours ? `${recommendation.durationHours}h duration` : null}
        </p>
      )}

      <p className="text-sm text-ink">{recommendation.reasoning}</p>

      {recommendation.constraintsConsidered?.length > 0 && (
        <ul className="mt-2.5 flex flex-wrap gap-1.5">
          {recommendation.constraintsConsidered.map((constraint) => (
            <li
              key={constraint}
              className="rounded-full border border-line bg-surface-raised px-2 py-0.5 text-xs text-ink-muted"
            >
              {humanise(constraint)}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

/**
 * AI notice board (plan §6.1): the feed of recommended grid actions, newest
 * first, each with the reasoning and the constraints the agent weighed.
 */
export default function NoticeBoard({ plantId, className = '' }) {
  const { data, isLoading, isError, error, refetch } = useRecommendations(plantId, 20);
  const recommendations = data?.recommendations ?? [];

  return (
    <Card
      title="AI notice board"
      subtitle={
        recommendations.length
          ? `${recommendations.length} recommendation${recommendations.length === 1 ? '' : 's'}`
          : 'Steps recommended by the Decision Agent'
      }
      icon={Lightbulb}
      className={className}
      bodyClassName="min-h-0 overflow-y-auto p-4"
    >
      {isLoading && <SkeletonList rows={3} />}

      {isError && (
        <ErrorState error={error} onRetry={refetch} title="Could not load recommendations" compact />
      )}

      {!isLoading && !isError && recommendations.length === 0 && (
        <EmptyState
          icon={Lightbulb}
          title="No recommendations yet"
          description="The Decision Agent produces a recommended grid action with every hourly forecast run."
        />
      )}

      {recommendations.length > 0 && (
        <ul className="space-y-3">
          {recommendations.map((recommendation) => (
            <RecommendationCard key={recommendation.id} recommendation={recommendation} />
          ))}
        </ul>
      )}
    </Card>
  );
}
