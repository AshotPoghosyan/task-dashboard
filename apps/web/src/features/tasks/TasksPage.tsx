import { ChevronsDownUp, ChevronsUpDown, Plus } from 'lucide-react';
import { lazy, Suspense, useCallback, useMemo, useRef, useState } from 'react';
import { useFilterOptions, useTaskCounts, useTasks } from '../../api/tasks';
import { FilterBar } from '../../components/data/FilterBar';
import { MoreFilters } from '../../components/data/MoreFilters';
import { StatusTabs, tabPanelProps } from '../../components/data/StatusTabs';
import { Button } from '../../components/ui/Button';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { useUrlParam } from '../../hooks/useUrlParam';
import { OnlyMineToggle } from '../me/OnlyMineToggle';
import { useOnlyMine } from '../me/useOnlyMine';
import {
  buildChips,
  filterDefs,
  FILTER_KEYS,
  hasActiveFilters,
  toFilterQuery,
  toQuery,
} from './filters';
import { allExpanded, findNode, hasChildren, visibleIds, type TaskNode } from './rows';
import { TableEmpty, TableError, TableSkeleton } from './TableStates';
import { TaskStats } from './TaskStats';
import { TasksTable } from './TasksTable';
import { DEFAULT_TAB, parseTab, TASK_TAB_HELP, taskTabs, type TaskTab } from './tabs';
import { useTaskHotkeys } from './useTaskHotkeys';

// Loaded on first use: keeps the dialog/drawer code (and form validation) out of the first paint.
const TaskDrawer = lazy(() => import('./TaskDrawer').then((m) => ({ default: m.TaskDrawer })));
const TaskFormDialog = lazy(() =>
  import('./TaskFormDialog').then((m) => ({ default: m.TaskFormDialog })),
);

type FormState = { task?: TaskNode; parentId?: string } | null;

export default function TasksPage() {
  const url = useUrlFilters(FILTER_KEYS);
  const [tabParam, setTabParam] = useUrlParam('tab');
  const [orderParam, setOrderParam] = useUrlParam('order');
  const mine = useOnlyMine();
  const { data: options } = useFilterOptions();
  const tab = parseTab(tabParam);
  const order = orderParam === 'asc' ? 'asc' : 'desc';
  const parts = { tab, me: mine.me?.id, mine: mine.active };
  const query = useTasks(toQuery(url.filters, url.search, parts, order));
  const counts = useTaskCounts(toFilterQuery(url.filters, url.search, parts));
  const setTab = (next: TaskTab | string) => setTabParam(next === DEFAULT_TAB ? null : next);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(null);
  // Once opened, stay mounted so close animations and state keep working.
  const drawerUsed = useRef(false);
  const formUsed = useRef(false);
  drawerUsed.current ||= openId !== null;
  formUsed.current ||= form !== null;

  const tasks = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);
  const ids = useMemo(() => visibleIds(tasks, expanded), [tasks, expanded]);
  const toggle = useCallback(
    (id: string) => {
      const node = findNode(tasks, id);
      if (node && hasChildren(node)) setExpanded((e) => ({ ...e, [id]: !e[id] }));
    },
    [tasks],
  );
  const { selectedId } = useTaskHotkeys({
    ids,
    enabled: !openId && !form,
    onOpen: setOpenId,
    onToggle: toggle,
  });

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;
  const onEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const filtered = hasActiveFilters(url.filters, url.search, mine.active, tab);
  const clearEverything = () => {
    url.clearAll();
    setTab(DEFAULT_TAB);
    if (mine.pressed) mine.toggle();
  };
  const PANEL_ID = 'tasks-panel';
  const anyExpanded = Object.values(expanded).some(Boolean);
  const hasSubBugs = tasks.some((t) => t.children.length > 0);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Tasks</h1>
        <div className="flex gap-2">
          {hasSubBugs ? (
            <Button onClick={() => setExpanded(anyExpanded ? {} : allExpanded(tasks))}>
              {anyExpanded ? (
                <ChevronsDownUp size={14} aria-hidden="true" />
              ) : (
                <ChevronsUpDown size={14} aria-hidden="true" />
              )}
              {anyExpanded ? 'Collapse all' : 'Expand all'}
            </Button>
          ) : null}
          <Button variant="primary" onClick={() => setForm({})}>
            <Plus size={14} aria-hidden="true" /> New task
          </Button>
        </div>
      </div>

      <TaskStats tab={tab} onTab={setTab} />

      <StatusTabs
        label="Task status"
        tabs={taskTabs(counts.data)}
        value={tab}
        onChange={setTab}
        panelId={PANEL_ID}
        help={TASK_TAB_HELP}
      />

      <FilterBar
        chips={buildChips(url.filters, url.search)}
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
        <MoreFilters defs={filterDefs(options)} values={url.filters} onChange={url.setFilter} />
      </FilterBar>

      <div {...tabPanelProps(PANEL_ID, tab)} className="flex min-h-0 flex-1 flex-col">
        {query.isPending ? (
          <TableSkeleton />
        ) : query.isError && !query.data ? (
          <TableError message={query.error.message} onRetry={() => void query.refetch()} />
        ) : tasks.length === 0 ? (
          <TableEmpty filtered={filtered} onClear={clearEverything} onCreate={() => setForm({})} />
        ) : (
          <TasksTable
            tasks={tasks}
            expanded={expanded}
            onExpandedChange={setExpanded}
            selectedId={selectedId}
            onOpen={setOpenId}
            onEndReached={onEndReached}
            order={order}
            onOrderChange={(o) => setOrderParam(o === 'desc' ? null : o)}
          />
        )}
      </div>

      <Suspense fallback={null}>
        {drawerUsed.current ? (
          <TaskDrawer
            task={findNode(tasks, openId)}
            onClose={() => setOpenId(null)}
            onEdit={(task) => setForm({ task })}
            onAddSubBug={(t) => setForm({ parentId: t.id })}
          />
        ) : null}
        {formUsed.current ? (
          <TaskFormDialog
            key={form ? (form.task?.id ?? form.parentId ?? 'new') : 'closed'}
            open={form !== null}
            onOpenChange={(open) => !open && setForm(null)}
            task={form?.task}
            parentId={form?.parentId}
          />
        ) : null}
      </Suspense>
    </div>
  );
}
