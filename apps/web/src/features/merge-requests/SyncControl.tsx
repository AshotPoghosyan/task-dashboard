import { formatDistanceToNow } from 'date-fns';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useSyncStatus, useTriggerSync } from '../../api/sync';
import { Button } from '../../components/ui/Button';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/Popover';
import { useToast } from '../../components/ui/Toast';
import { formatDateTime } from '../../lib/datetime';

/** "Sync now" button, last-synced time, and a popover listing per-repository errors. */
export function SyncControl() {
  const { data } = useSyncStatus();
  const trigger = useTriggerSync();
  const toast = useToast();

  const failed = (data?.repositories ?? []).filter((r) => r.lastRun?.status === 'FAILED');
  const last = (data?.repositories ?? [])
    .flatMap((r) => (r.lastSyncedAt ? [r.lastSyncedAt] : []))
    .sort()
    .at(-1);
  const running = trigger.isPending || data?.running;

  const sync = () =>
    trigger.mutate(undefined, {
      onSuccess: (r) =>
        toast({ title: 'Sync queued', description: `${r.queued} repositories`, tone: 'success' }),
      onError: (e) =>
        toast({ title: 'Could not start sync', description: e.message, tone: 'error' }),
    });

  return (
    <div className="flex items-center gap-3">
      {last ? (
        <time
          dateTime={last}
          title={formatDateTime(last)}
          className="tabular text-xs text-fg-secondary"
        >
          Last synced {formatDistanceToNow(new Date(last), { addSuffix: true })}
        </time>
      ) : data ? (
        <span className="text-xs text-fg-muted">Never synced</span>
      ) : null}
      {failed.length > 0 ? (
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="ghost" className="text-danger">
              <AlertTriangle size={14} aria-hidden="true" />
              {failed.length} {failed.length === 1 ? 'repository' : 'repositories'} failed
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <h2 className="mb-2 text-xs font-medium text-fg-secondary">Sync errors</h2>
            <ul className="flex flex-col gap-2">
              {failed.map((r) => (
                <li key={r.repositoryId}>
                  <div className="text-sm text-fg">{r.fullPath}</div>
                  <div className="break-words text-xs text-danger">
                    {r.lastRun?.error ?? 'Unknown error'}
                  </div>
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>
      ) : null}
      <Button variant="primary" onClick={sync} disabled={running}>
        <RefreshCw size={14} aria-hidden="true" className={running ? 'animate-spin' : undefined} />
        {running ? 'Syncing…' : 'Sync now'}
      </Button>
    </div>
  );
}
