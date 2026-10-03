import { ChevronsDownUp, ChevronsUpDown, Plus } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useTasks } from '../../api/tasks';
import { Button } from '../../components/ui/Button';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { FILTER_KEYS, toQuery } from './filters';
import { allExpanded, findNode, hasChildren, visibleIds, type TaskNode } from './rows';
import { TableEmpty, TableError, TableSkeleton } from './TableStates';
import { TaskDrawer } from './TaskDrawer';
import { TaskFilterBar } from './TaskFilterBar';
import { TaskFormDialog } from './TaskFormDialog';
import { TaskStats } from './TaskStats';
import { TasksTable } from './TasksTable';
import { useTaskHotkeys } from './useTaskHotkeys';

type FormState = { task?: TaskNode; parentId?: string } | null;

export default function TasksPage() {
  const url = useUrlFilters(FILTER_KEYS);
  const query = useTasks(toQuery(url.filters, url.search));
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(null);

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

  const filtered = Object.values(url.filters).some((v) => v.length > 0) || url.search !== '';
  const anyExpanded = Object.values(expanded).some(Boolean);
  const hasSubBugs = tasks.some((t) => t.children.length > 0);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
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

      <TaskStats filters={url.filters} onStatus={(s) => url.setFilter('status', s)} />
      <TaskFilterBar {...url} />

      {query.isPending ? (
        <TableSkeleton />
      ) : query.isError && !query.data ? (
        <TableError message={query.error.message} onRetry={() => void query.refetch()} />
      ) : tasks.length === 0 ? (
        <TableEmpty filtered={filtered} onClear={url.clearAll} onCreate={() => setForm({})} />
      ) : (
        <TasksTable
          tasks={tasks}
          expanded={expanded}
          onExpandedChange={setExpanded}
          selectedId={selectedId}
          onOpen={setOpenId}
          onEndReached={onEndReached}
        />
      )}

      <TaskDrawer
        task={findNode(tasks, openId)}
        onClose={() => setOpenId(null)}
        onEdit={(task) => setForm({ task })}
        onAddSubBug={(t) => setForm({ parentId: t.id })}
      />
      <TaskFormDialog
        key={form ? (form.task?.id ?? form.parentId ?? 'new') : 'closed'}
        open={form !== null}
        onOpenChange={(open) => !open && setForm(null)}
        task={form?.task}
        parentId={form?.parentId}
      />
    </div>
  );
}
