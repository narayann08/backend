import { useQuery } from '@tanstack/react-query';
import { fetchPlants, fetchPlant, fetchLiveGeneration, fetchPerformance } from '../api/plants';
import { queryKeys } from './queryKeys';
import { POLL_INTERVALS } from '../api/config';

/** Plants the signed-in user can see. */
export function usePlants(filters = {}) {
  return useQuery({
    queryKey: queryKeys.plants(filters),
    queryFn: () => fetchPlants(filters),
  });
}

/** A single plant's details. */
export function usePlant(plantId) {
  return useQuery({
    queryKey: queryKeys.plant(plantId),
    queryFn: () => fetchPlant(plantId),
    enabled: Boolean(plantId),
  });
}

/** Latest reading vs forecast baseline, polled for the live widget. */
export function useLiveGeneration(plantId) {
  return useQuery({
    queryKey: queryKeys.liveGeneration(plantId),
    queryFn: () => fetchLiveGeneration(plantId),
    enabled: Boolean(plantId),
    refetchInterval: POLL_INTERVALS.liveGeneration,
    // A plant with no telemetry yet 404s; that is a real state, not a glitch.
    retry: (failureCount, error) => error?.status !== 404 && failureCount < 1,
  });
}

/**
 * Classification (lower/usual/higher) plus the attributed causes.
 * Drives the map tooltip and the AI decisions card.
 */
export function usePerformance(plantId) {
  return useQuery({
    queryKey: queryKeys.performance(plantId),
    queryFn: () => fetchPerformance(plantId),
    enabled: Boolean(plantId),
    refetchInterval: POLL_INTERVALS.performance,
  });
}
