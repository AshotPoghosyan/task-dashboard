import type { MergeRequest } from '@mrdash/shared';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { makeMr } from '../features/merge-requests/__tests__/mrUtils';
import { createHighlightStore } from './highlights';
import { affectedKeys, applyLiveEvent } from './liveUpdates';

/** Seeds the cache and mounts an observer so invalidation really refetches `next`. */
function setup(initial: MergeRequest[], next: MergeRequest[]) {
  const qc = new QueryClient();
  const data = (items: MergeRequest[]) => ({
    pages: [{ items, nextCursor: null }],
    pageParams: [undefined],
  });
  qc.setQueryData(['merge-requests', {}], data(initial));
  new QueryObserver(qc, {
    queryKey: ['merge-requests', {}],
    queryFn: async () => data(next),
    staleTime: Infinity,
  }).subscribe(() => {});
  return qc;
}

describe('affectedKeys', () => {
  it('limits each event to the queries it can change', () => {
    expect(affectedKeys('mr.updated')).toEqual([
      ['merge-requests'],
      ['merge-request-counts'],
      ['stats'],
      ['tasks'],
      ['task-counts'],
    ]);
    expect(affectedKeys('task.updated')).toEqual([['tasks'], ['task-counts'], ['stats']]);
    expect(affectedKeys('sync.finished')).toContainEqual(['sync', 'status']);
    expect(affectedKeys('task.updated')).not.toContainEqual(['merge-requests']);
  });
});

describe('applyLiveEvent', () => {
  it('invalidates only the affected queries', async () => {
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    await applyLiveEvent(
      qc,
      'task.updated',
      { id: 't1' },
      {
        highlights: createHighlightStore(),
        onStatusChange: vi.fn(),
      },
    );
    expect(spy.mock.calls.map(([f]) => f?.queryKey)).toEqual([
      ['tasks'],
      ['task-counts'],
      ['stats'],
    ]);
  });

  it('ignores malformed payloads', async () => {
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    await applyLiveEvent(
      qc,
      'mr.updated',
      { nope: 1 },
      {
        highlights: createHighlightStore(),
        onStatusChange: vi.fn(),
      },
    );
    expect(spy).not.toHaveBeenCalled();
  });

  it('highlights the row and reports a status change after the refetch', async () => {
    const qc = setup([makeMr('a')], [makeMr('a', { status: 'MERGED' })]);
    const highlights = createHighlightStore();
    const onStatusChange = vi.fn();
    await applyLiveEvent(
      qc,
      'mr.updated',
      { id: 'a', repositoryId: 'r1' },
      { highlights, onStatusChange },
    );
    expect(highlights.has('a')).toBe(true);
    expect(onStatusChange).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'OPEN', mr: expect.objectContaining({ status: 'MERGED' }) }),
    );
  });

  it('does not notify when the status is unchanged', async () => {
    const qc = setup([makeMr('a')], [makeMr('a', { title: 'renamed' })]);
    const onStatusChange = vi.fn();
    await applyLiveEvent(
      qc,
      'mr.updated',
      { id: 'a', repositoryId: 'r1' },
      {
        highlights: createHighlightStore(),
        onStatusChange,
      },
    );
    expect(onStatusChange).not.toHaveBeenCalled();
  });
});

describe('highlight store', () => {
  it('expires entries and notifies subscribers', () => {
    vi.useFakeTimers();
    const store = createHighlightStore(1000);
    const listener = vi.fn();
    store.subscribe(listener);
    store.add('a');
    expect(store.has('a')).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(store.has('a')).toBe(false);
    expect(listener).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
