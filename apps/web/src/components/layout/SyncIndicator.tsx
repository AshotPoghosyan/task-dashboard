import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { useSyncStatus, useTriggerSync } from '../../api/sync';
import { formatDateTime, relativeAge } from '../../lib/datetime';
import { Button } from '../ui/Button';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/Popover';
import { useToast } from '../ui/Toast';

/**
 * The one place sync status lives: last synced time (or "Not synced yet"), per-repository
 * failures in a popover, and a "Sync now" button.
 */
export function SyncIndicator() {
  const { data, isError } = useSyncStatus();
  const trigger = useTriggerSync();
  const toast = useToast();

  if (isError) {
    return (
      <span className="flex items-center gap-1 text-xs text-danger">
        <AlertTriangle size={14} aria-hidden="true" /> Sync status unavailable
      </span>
    );
  }
  if (!data) return <span className="text-xs text-fg-muted">Checking sync…</span>;

  const running = trigger.isPending || data.running;
  const failed = data.repositories.filter((r) => r.lastRun?.status === 'FAILED');
  const last = data.repositories
    .flatMap((r) => (r.lastSyncedAt ? [r.lastSyncedAt] : []))
    .sort()
    .at(-1);

  const sync = () =>
    trigger.mutate(undefined, {
      onSuccess: (r) =>
        toast({ title: 'Sync started', description: `${r.queued} repositories`, tone: 'success' }),
      onError: (e) =>
        toast({ title: 'Could not start sync', description: e.message, tone: 'error' }),
    });

  return (
    <div className="flex items-center gap-2">
      <span role="status" className="flex items-center gap-1 text-xs text-fg-secondary">
        {running ? (
          <>
            <Loader2 size={14} className="animate-spin" aria-hidden="true" /> Syncing…
          </>
        ) : last ? (
          <>
            <CheckCircle2 size={14} className="text-success" aria-hidden="true" />
            <time dateTime={last} title={formatDateTime(last)} className="tabular hidden sm:inline">
              Synced {relativeAge(last)}
            </time>
          </>
        ) : (
          <span className="hidden sm:inline">Not synced yet</span>
        )}
      </span>
      {failed.length > 0 ? (
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="ghost" className="text-danger">
              <AlertTriangle size={14} aria-hidden="true" />
              {failed.length} failed
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
      <Button size="sm" onClick={sync} disabled={running}>
        <RefreshCw size={14} aria-hidden="true" className={running ? 'animate-spin' : undefined} />
        <span className="sr-only sm:not-sr-only">Sync now</span>
      </Button>
    </div>
  );
}
