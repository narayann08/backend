import { useQuery } from '@tanstack/react-query';
import { fetchForecast, fetchHistory } from '../api/forecast';
import { fetchWeather } from '../api/weather';
import { queryKeys } from './queryKeys';
import { POLL_INTERVALS } from './../api/config';

/**
 * Latest forecast for a horizon.
 *
 * A 404 means "no run has completed yet" — a normal state on a fresh install —
 * so we do not retry it and callers check `error.status === 404`.
 */
export function useForecast(plantId, horizon = 24) {
  return useQuery({
    queryKey: queryKeys.forecast(plantId, horizon),
    queryFn: () => fetchForecast(plantId, horizon),
    enabled: Boolean(plantId),
    refetchInterval: POLL_INTERVALS.forecast,
    retry: (failureCount, error) => error?.status !== 404 && failureCount < 1,
  });
}

/** Reconciled weather + current-condition summary for the map overlay. */
export function useWeather(plantId, { hours = 72 } = {}) {
  return useQuery({
    queryKey: queryKeys.weather(plantId, hours),
    queryFn: () => fetchWeather(plantId, { hours }),
    enabled: Boolean(plantId),
    refetchInterval: POLL_INTERVALS.weather,
  });
}

/**
 * Forecast-vs-actual history for a date range.
 *
 * Cached per range (the ISO strings are part of the key), so flipping between
 * presets is instant after the first fetch.
 */
export function useHistory(plantId, from, to) {
  const fromIso = from instanceof Date ? from.toISOString() : from;
  const toIso = to instanceof Date ? to.toISOString() : to;

  return useQuery({
    queryKey: queryKeys.history(plantId, fromIso, toIso),
    queryFn: () => fetchHistory(plantId, { from: fromIso, to: toIso }),
    enabled: Boolean(plantId && fromIso && toIso),
    // History is expensive and changes slowly; keep it warm for a minute.
    staleTime: 60_000,
  });
}
