import type { Task } from '@mrdash/shared';
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  useReactTable,
  type ExpandedState,
  type OnChangeFn,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useRef, type ProfilerOnRenderCallback } from 'react';
import { cn } from '../../lib/cn';
import { columns, GRID } from './columns';
import { getSubRows, type TaskNode } from './rows';
import { ROW_HEIGHT, TaskRow } from './TaskRow';

interface TasksTableProps {
  tasks: Task[];
  expanded: Record<string, boolean>;
  onExpandedChange: (next: Record<string, boolean>) => void;
  selectedId: string | null;
  onOpen: (id: string) => void;
  /** Called when more rows should be fetched (scrolled near the end). */
  onEndReached?: () => void;
  /** Profiler hook, used to verify that expanding re-renders only the toggled row. */
  onRowRender?: ProfilerOnRenderCallback;
}

export function TasksTable({
  tasks,
  expanded,
  onExpandedChange,
  selectedId,
  onOpen,
  onEndReached,
  onRowRender,
}: TasksTableProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const onChange: OnChangeFn<ExpandedState> = (updater) => {
    const next = typeof updater === 'function' ? updater(expanded) : updater;
    onExpandedChange(next === true ? {} : next);
  };

  const table = useReactTable<TaskNode>({
    data: tasks,
    columns,
    state: { expanded },
    onExpandedChange: onChange,
    getRowId: (t) => t.id,
    getSubRows,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  });
  const rows = table.getRowModel().rows;

  const virtual = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
    getItemKey: (i) => rows[i]?.id ?? i,
  });
  const items = virtual.getVirtualItems();
  const top = items[0]?.start ?? 0;
  const bottom = virtual.getTotalSize() - (items.at(-1)?.end ?? 0);
  const lastIndex = items.at(-1)?.index ?? 0;

  useEffect(() => {
    if (onEndReached && rows.length > 0 && lastIndex >= rows.length - 15) onEndReached();
  }, [lastIndex, rows.length, onEndReached]);

  // Keep the keyboard selection in view.
  const selectedIndex = rows.findIndex((r) => r.id === selectedId);
  useEffect(() => {
    if (selectedIndex >= 0) virtual.scrollToIndex(selectedIndex);
    // `virtual` is stable per render of the hook; only the selection should trigger scrolling.
  }, [selectedIndex]);

  return (
    <div
      ref={scrollRef}
      className="min-h-0 flex-1 overflow-auto rounded-card border border-border bg-surface"
    >
      <table
        role="table"
        aria-label="Tasks"
        aria-rowcount={rows.length + 1}
        className="block min-w-fit"
      >
        <thead role="rowgroup" className="sticky top-0 z-10 block bg-surface">
          {table.getHeaderGroups().map((group) => (
            <tr
              key={group.id}
              role="row"
              className={cn('grid items-center gap-3 border-b border-border px-3 py-2', GRID)}
            >
              {group.headers.map((h) => (
                <th
                  key={h.id}
                  role="columnheader"
                  scope="col"
                  className={cn(
                    'text-left text-xs font-medium text-fg-secondary',
                    h.column.columnDef.meta?.className,
                  )}
                >
                  {flexRender(h.column.columnDef.header, h.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody role="rowgroup" className="block" style={{ paddingTop: top, paddingBottom: bottom }}>
          {items.map((item) => {
            const row = rows[item.index];
            if (!row) return null;
            return (
              <TaskRow
                key={row.id}
                row={row}
                expanded={row.getIsExpanded()}
                selected={row.id === selectedId}
                onOpen={onOpen}
                onRender={onRowRender}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
