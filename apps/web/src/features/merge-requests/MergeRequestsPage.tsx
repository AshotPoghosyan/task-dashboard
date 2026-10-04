import { useCallback, useMemo } from 'react';
import { useMergeRequestCounts, useMergeRequests } from '../../api/mergeRequests';
import { useFilterOptions } from '../../api/tasks';
import { FilterBar } from '../../components/data/FilterBar';
import { MoreFilters } from '../../components/data/MoreFilters';
import { StatusTabs, tabPanelProps } from '../../components/data/StatusTabs';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { useUrlParam } from '../../hooks/useUrlParam';
import { OnlyMineToggle } from '../me/OnlyMineToggle';
import { useOnlyMine } from '../me/useOnlyMine';
import {
  buildChips,
  filterDefs,
  FILTER_KEYS,
  hasActiveFilters,
  optionsByKey,
  toFilterQuery,
  toQuery,
} from './filters';
import { MrEmpty, MrError, MrSkeleton } from './MrStates';
import { MrTable } from './MrTable';
import { DEFAULT_TAB, MR_TAB_HELP, mrTabs, parseTab } from './tabs';

const PANEL_ID = 'mr-panel';

export default function MergeRequestsPage() {
  const url = useUrlFilters(FILTER_KEYS);
  const [tabParam, setTabParam] = useUrlParam('tab');
  const [orderParam, setOrderParam] = useUrlParam('order');
  const mine = useOnlyMine();
  const { data: options } = useFilterOptions();

  const tab = parseTab(tabParam);
  const order = orderParam === 'asc' ? 'asc' : 'desc';
  const parts = { tab, me: mine.me?.id, mine: mine.active };
  const query = useMergeRequests(toQuery(url.filters, url.search, parts, order));
  const counts = useMergeRequestCounts(toFilterQuery(url.filters, url.search, parts));

  const items = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);
  const repoNames = useMemo(
    () => Object.fromEntries((options?.repositories ?? []).map((r) => [r.id, r.fullPath])),
    [options],
  );
  const optionMap = optionsByKey(options);

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;
  const onEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const setTab = (id: string) => setTabParam(id === DEFAULT_TAB ? null : id);
  const filtered = hasActiveFilters(url.filters, url.search, mine.active);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <h1 className="text-xl font-semibold">Merge Requests</h1>

      <StatusTabs
        label="Merge request status"
        tabs={mrTabs(counts.data)}
        value={tab}
        onChange={setTab}
        panelId={PANEL_ID}
        help={MR_TAB_HELP}
      />

      <FilterBar
        chips={buildChips(url.filters, url.search, optionMap)}
        onClearAll={url.clearAll}
        onRemove={(chip) => {
          if (chip.key === 'q') return url.setSearch('');
          url.setFilter(
            chip.key,
            (url.filters[chip.key] ?? []).filter((v) => v !== (chip.raw ?? chip.value)),
          );
        }}
      >
        <OnlyMineToggle mine={mine} />
        <MoreFilters defs={filterDefs(optionMap)} values={url.filters} onChange={url.setFilter} />
      </FilterBar>

      <div {...tabPanelProps(PANEL_ID, tab)} className="flex min-h-0 flex-1 flex-col">
        {query.isPending ? (
          <MrSkeleton />
        ) : query.isError && !query.data ? (
          <MrError message={query.error.message} onRetry={() => void query.refetch()} />
        ) : items.length === 0 ? (
          <MrEmpty
            attention={tab === 'attention'}
            filtered={filtered}
            onClear={() => {
              url.clearAll();
              if (mine.pressed) mine.toggle();
            }}
            onShowAll={() => setTab('all')}
          />
        ) : (
          <MrTable
            items={items}
            repoNames={repoNames}
            onEndReached={onEndReached}
            stale={query.isPlaceholderData}
            order={tab === 'attention' ? undefined : order}
            onOrderChange={(o) => setOrderParam(o === 'desc' ? null : o)}
          />
        )}
      </div>
    </div>
  );
}
