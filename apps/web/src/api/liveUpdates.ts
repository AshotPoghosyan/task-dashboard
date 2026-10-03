import {
  sseEventSchemas,
  STATUS_DISPLAY,
  type MergeRequest,
  type MrStatus,
  type SseEventName,
  type SseEventPayloads,
} from '@mrdash/shared';
import type { InfiniteData, QueryClient, QueryKey } from '@tanstack/react-query';
import type { HighlightStore } from './highlights';
import { mergeRequestsKey } from './mergeRequests';
import { syncStatusKey } from './sync';
import { tasksKey } from './taskCache';

interface Page {
  items: MergeRequest[];
}

/** Query keys whose data an event can change. Active ones refetch; the rest are marked stale. */
export function affectedKeys(name: SseEventName): QueryKey[] {
  switch (name) {
    case 'mr.updated':
      // A merge request change moves counts and the status of tasks that link it.
      return [mergeRequestsKey, ['stats'], tasksKey];
    case 'task.updated':
      return [tasksKey, ['stats']];
    case 'sync.finished':
      return [mergeRequestsKey, tasksKey, ['stats'], ['filter-options'], syncStatusKey];
  }
}

export function findCachedMr(qc: QueryClient, id: string): MergeRequest | undefined {
  for (const [, data] of qc.getQueriesData<InfiniteData<Page>>({ queryKey: mergeRequestsKey })) {
    for (const page of data?.pages ?? []) {
      const found = page.items.find((m) => m.id === id);
      if (found) return found;
    }
  }
  return undefined;
}

export interface StatusChange {
  mr: MergeRequest;
  from: MrStatus;
}

interface Hooks {
  highlights: HighlightStore;
  onStatusChange: (change: StatusChange) => void;
}

/** Validates and applies one SSE event: invalidate affected queries, then highlight / notify. */
export async function applyLiveEvent(
  qc: QueryClient,
  name: SseEventName,
  raw: unknown,
  { highlights, onStatusChange }: Hooks,
): Promise<void> {
  const parsed = sseEventSchemas[name].safeParse(raw);
  if (!parsed.success) return;
  const payload = parsed.data as SseEventPayloads[SseEventName];

  const before =
    name === 'mr.updated' ? findCachedMr(qc, (payload as { id: string }).id) : undefined;
  await Promise.all(affectedKeys(name).map((queryKey) => qc.invalidateQueries({ queryKey })));
  if (name !== 'mr.updated') return;

  const id = (payload as { id: string }).id;
  highlights.add(id);
  const after = findCachedMr(qc, id);
  if (before && after && before.status !== after.status) {
    onStatusChange({ mr: after, from: before.status });
  }
}

export const statusChangeMessage = ({ mr, from }: StatusChange) => ({
  title: `${mr.provider === 'GITLAB' ? '!' : '#'}${mr.number} is now ${STATUS_DISPLAY[mr.status].label}`,
  description: `${mr.title} (was ${STATUS_DISPLAY[from].label})`,
});
