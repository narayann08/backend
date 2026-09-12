import { useMutation, useQuery } from '@tanstack/react-query';
import {
  fetchLatestRecommendation,
  fetchRecommendations,
  fetchExplanation,
  askChatbot,
} from '../api/decisions';
import { queryKeys } from './queryKeys';
import { POLL_INTERVALS } from '../api/config';

/**
 * The single latest recommendation, polled at the cron cadence.
 * 404 means the agent has not produced one yet — a normal state, not an error.
 */
export function useLatestRecommendation(plantId) {
  return useQuery({
    queryKey: queryKeys.recommendation(plantId),
    queryFn: () => fetchLatestRecommendation(plantId),
    enabled: Boolean(plantId),
    refetchInterval: POLL_INTERVALS.recommendation,
    retry: (failureCount, error) => error?.status !== 404 && failureCount < 1,
  });
}

/** Recommendation feed for the notice board. */
export function useRecommendations(plantId, limit = 20) {
  return useQuery({
    queryKey: queryKeys.recommendations(plantId, limit),
    queryFn: () => fetchRecommendations(plantId, limit),
    enabled: Boolean(plantId),
    refetchInterval: POLL_INTERVALS.recommendation,
  });
}

/** Plain-language rationale behind the current forecast/recommendation. */
export function useExplanation(plantId) {
  return useQuery({
    queryKey: queryKeys.explanation(plantId),
    queryFn: () => fetchExplanation(plantId),
    enabled: Boolean(plantId),
    retry: (failureCount, error) => error?.status !== 404 && failureCount < 1,
  });
}

/**
 * Send a chat message.
 *
 * Deliberately a mutation, not a query: each question is a one-off action and
 * must never be replayed from cache. A 503 (model unreachable) surfaces to the
 * UI as an error — the backend does not fabricate replies.
 */
export function useChatbot(plantId) {
  return useMutation({
    mutationFn: ({ message, history }) => askChatbot(plantId, message, history),
  });
}
