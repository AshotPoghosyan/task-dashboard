import { syncStatusResponseSchema, triggerSyncResponseSchema } from '@mrdash/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';

export const syncStatusKey = ['sync', 'status'] as const;

export const useSyncStatus = () =>
  useQuery({
    queryKey: syncStatusKey,
    queryFn: () => api('/sync/status', { schema: syncStatusResponseSchema }),
    refetchInterval: 30_000,
  });

export function useTriggerSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api('/sync', { method: 'POST', schema: triggerSyncResponseSchema }),
    onSuccess: () => qc.invalidateQueries({ queryKey: syncStatusKey }),
  });
}
