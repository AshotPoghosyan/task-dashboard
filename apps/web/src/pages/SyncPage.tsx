import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useSyncStatus, useTriggerSync } from '../api/sync';
import { formatDateTime } from '../lib/datetime';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { useToast } from '../components/ui/Toast';
import { ProviderIcon } from '../components/data/ProviderIcon';

export default function SyncPage() {
  const { data, isPending, isError, refetch } = useSyncStatus();
  const trigger = useTriggerSync();
  const toast = useToast();

  const sync = () =>
    trigger.mutate(undefined, {
      onSuccess: (r) =>
        toast({
          title: 'Sync queued',
          description: `${r.queued} ${r.queued === 1 ? 'repository' : 'repositories'}`,
          tone: 'success',
        }),
      onError: () => toast({ title: 'Could not start sync', tone: 'error' }),
    });

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Sync</h1>
        <Button variant="primary" onClick={sync} disabled={trigger.isPending || data?.running}>
          <RefreshCw size={14} aria-hidden="true" /> {data?.running ? 'Syncing…' : 'Sync now'}
        </Button>
      </div>
      {isPending ? <Skeleton className="h-24 w-full" /> : null}
      {isError ? (
        <EmptyState
          title="Could not load sync status"
          action={<Button onClick={() => void refetch()}>Retry</Button>}
        />
      ) : null}
      {data && data.repositories.length === 0 ? (
        <EmptyState title="No repositories configured" />
      ) : null}
      {data && data.repositories.length > 0 ? (
        <ul className="divide-y divide-border rounded-card border border-border bg-surface">
          {data.repositories.map((r) => (
            <li key={r.repositoryId} className="flex items-center gap-3 p-3 text-sm">
              <ProviderIcon provider={r.provider} />
              <span className="flex-1 text-fg">{r.fullPath}</span>
              {r.lastRun?.error ? (
                <span className="flex items-center gap-1 text-danger">
                  <AlertTriangle size={14} aria-hidden="true" /> {r.lastRun.error}
                </span>
              ) : null}
              <span className="tabular text-fg-secondary">
                {r.lastSyncedAt ? formatDateTime(r.lastSyncedAt) : 'Never synced'}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}
