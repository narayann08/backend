import { useOutletContext, useParams } from 'react-router-dom';
import { MessageSquareText } from 'lucide-react';

import Card from '../../components/Card';
import ErrorBoundary from '../../components/ErrorBoundary';
import { Skeleton } from '../../components/States';
import { useExplanation } from '../../hooks/useDecisions';
import NoticeBoard from './NoticeBoard';
import ChatBox from './ChatBox';
import { humanise } from '../../utils/format';

/**
 * Decisions screen (plan §6): the AI notice board alongside the plant-scoped
 * chatbot, with the Explainability Agent's current rationale on top.
 */
export default function DecisionsPage() {
  const { plantId } = useParams();
  const { plant } = useOutletContext() ?? {};
  const explanation = useExplanation(plantId);

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <header>
        <h1 className="text-xl font-bold tracking-tight text-ink">Decisions</h1>
        <p className="text-sm text-ink-muted">
          Recommended actions from the agent pipeline, and a plant-scoped assistant
        </p>
      </header>

      {/* Current rationale */}
      <Card title="Current rationale" subtitle="From the Explainability Agent" icon={MessageSquareText}>
        {explanation.isLoading && (
          <div className="space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        )}

        {explanation.isError && explanation.error?.status === 404 && (
          <p className="text-sm text-ink-muted">
            No explanation yet — one is produced with each hourly forecast run.
          </p>
        )}

        {explanation.isError && explanation.error?.status !== 404 && (
          <p className="text-sm text-severity-high">{explanation.error.message}</p>
        )}

        {explanation.data && (
          <>
            <p className="text-sm text-ink">{explanation.data.summary}</p>
            {explanation.data.factors?.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {explanation.data.factors.map((factor) => (
                  <li
                    key={factor}
                    className="rounded-full border border-line bg-surface px-2.5 py-1 text-xs text-ink-muted"
                  >
                    {humanise(factor)}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <ErrorBoundary title="The notice board failed">
          <NoticeBoard plantId={plantId} className="max-h-[38rem]" />
        </ErrorBoundary>

        <ErrorBoundary title="The chat panel failed">
          <ChatBox
            key={plantId}
            plantId={plantId}
            plantName={plant?.name}
            className="h-[38rem]"
          />
        </ErrorBoundary>
      </div>
    </div>
  );
}
