import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { fetchAlerts, acknowledgeAlert, fetchNotifications } from '../api/alerts';
import { queryKeys } from './queryKeys';
import { POLL_INTERVALS, SOCKET_URL } from '../api/config';

/**
 * Alerts for a plant, optionally filtered by severity.
 *
 * "All" is client-side: the backend has no `severity=all`, so we simply omit
 * the parameter.
 */
export function useAlerts({ plantId, severity } = {}) {
  const filters = { plantId, ...(severity ? { severity } : {}) };
  return useQuery({
    queryKey: queryKeys.alerts(filters),
    queryFn: () => fetchAlerts(filters),
    refetchInterval: POLL_INTERVALS.alerts,
  });
}

/** Acknowledge an alert, then refresh every alert list in the cache. */
export function useAcknowledgeAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: acknowledgeAlert,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts'] }),
  });
}

/**
 * Live alert push.
 *
 * The backend emits `new_alert` over Socket.IO whenever the agent pipeline
 * raises one. We invalidate rather than splice the payload into the cache, so
 * the list always reflects exactly what the API would return. Polling
 * (POLL_INTERVALS.alerts) remains the fallback if the socket never connects.
 */
export function useAlertSocket() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      // Never let a dead socket spam the console in a control room.
      reconnectionDelayMax: 10_000,
    });

    const handleNewAlert = () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    };

    socket.on('new_alert', handleNewAlert);

    return () => {
      socket.off('new_alert', handleNewAlert);
      socket.disconnect();
    };
  }, [queryClient]);
}

/** Notification dispatch log (socket pushes + email escalations). */
export function useNotifications({ plantId, limit = 20 } = {}) {
  const filters = { plantId, limit };
  return useQuery({
    queryKey: queryKeys.notifications(filters),
    queryFn: () => fetchNotifications(filters),
    refetchInterval: POLL_INTERVALS.notifications,
  });
}
