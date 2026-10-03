import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { useSyncStatus } from '../../api/sync';
import { formatDateTime, relativeAge } from '../../lib/datetime';

/** Compact top-bar status: syncing / last synced time / failures. */
export function SyncIndicator() {
  const { data, isError } = useSyncStatus();
  if (isError) {
    return (
      <span className="flex items-center gap-1 text-xs text-danger">
        <AlertTriangle size={14} aria-hidden="true" /> Sync status unavailable
      </span>
    );
  }
  if (!data) return <span className="text-xs text-fg-muted">Checking sync…</span>;
  if (data.running) {
    return (
      <span role="status" className="flex items-center gap-1 text-xs text-fg-secondary">
        <Loader2 size={14} className="animate-spin" aria-hidden="true" /> Syncing…
      </span>
    );
  }
  const failed = data.repositories.filter((r) => r.lastRun?.status === 'FAILED').length;
  const times = data.repositories.flatMap((r) => (r.lastSyncedAt ? [r.lastSyncedAt] : []));
  const last = times.sort().at(-1);
  return (
    <span role="status" className="flex items-center gap-1 text-xs text-fg-secondary">
      {failed > 0 ? (
        <>
          <AlertTriangle size={14} className="text-danger" aria-hidden="true" />
          <span className="tabular">{failed} failed</span>
        </>
      ) : (
        <CheckCircle2 size={14} className="text-success" aria-hidden="true" />
      )}
      {last ? (
        <time dateTime={last} title={formatDateTime(last)} className="tabular">
          Synced {relativeAge(last)}
        </time>
      ) : (
        'Never synced'
      )}
    </span>
  );
}
