import { useCallback, useMemo } from 'react';
import { useMergeRequests } from '../../api/mergeRequests';
import { useFilterOptions } from '../../api/tasks';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { FILTER_KEYS, hasActiveFilters, toQuery } from './filters';
import { MrFilterBar } from './MrFilterBar';
import { MrEmpty, MrError, MrSkeleton } from './MrStates';
import { MrStats } from './MrStats';
import { MrTable } from './MrTable';
import { SyncControl } from './SyncControl';

export default function MergeRequestsPage() {
  const url = useUrlFilters(FILTER_KEYS);
  const query = useMergeRequests(toQuery(url.filters, url.search));
  const { data: options } = useFilterOptions();

  const items = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);
  const repoNames = useMemo(
    () => Object.fromEntries((options?.repositories ?? []).map((r) => [r.id, r.fullPath])),
    [options],
  );

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;
  const onEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Merge Requests</h1>
        <SyncControl />
      </div>

      <MrStats filters={url.filters} onStatus={(s) => url.setFilter('status', s)} />
      <MrFilterBar {...url} />

      {query.isPending ? (
        <MrSkeleton />
      ) : query.isError && !query.data ? (
        <MrError message={query.error.message} onRetry={() => void query.refetch()} />
      ) : items.length === 0 ? (
        <MrEmpty filtered={hasActiveFilters(url.filters, url.search)} onClear={url.clearAll} />
      ) : (
        <MrTable
          items={items}
          repoNames={repoNames}
          onEndReached={onEndReached}
          stale={query.isPlaceholderData}
        />
      )}
    </div>
  );
}
