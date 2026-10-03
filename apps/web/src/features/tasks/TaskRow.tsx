import { flexRender, type Row } from '@tanstack/react-table';
import { memo, Profiler, type ProfilerOnRenderCallback } from 'react';
import { cn } from '../../lib/cn';
import { GRID } from './columns';
import type { TaskNode } from './rows';

interface TaskRowProps {
  row: Row<TaskNode>;
  /** Passed as props (not read from the table) so memoization sees every change. */
  expanded: boolean;
  selected: boolean;
  onOpen: (id: string) => void;
  onRender?: ProfilerOnRenderCallback;
}

export const ROW_HEIGHT = 40;

function TaskRowView({ row, expanded, selected, onOpen, onRender }: TaskRowProps) {
  const task = row.original;
  const isSub = row.depth > 0;
  const tr = (
    <tr
      role="row"
      data-row-id={task.id}
      aria-level={row.depth + 1}
      aria-selected={selected}
      aria-expanded={row.getCanExpand() ? expanded : undefined}
      onClick={() => onOpen(task.id)}
      style={{ height: ROW_HEIGHT }}
      className={cn(
        'grid cursor-pointer items-center gap-3 border-b border-border px-3 text-sm hover:bg-raised',
        GRID,
        selected && 'bg-raised outline outline-1 -outline-offset-1 outline-accent',
        isSub && 'animate-[row-in_150ms_ease-out]',
      )}
    >
      {row.getVisibleCells().map((cell) => (
        <td
          key={cell.id}
          role="cell"
          className={cn(
            'relative min-w-0 truncate',
            cell.column.columnDef.meta?.className,
            isSub &&
              cell.column.id === 'id' &&
              'pl-6 before:absolute before:inset-y-[-20px] before:left-3 before:w-px before:bg-border',
          )}
        >
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </td>
      ))}
    </tr>
  );
  return onRender ? (
    <Profiler id={task.id} onRender={onRender}>
      {tr}
    </Profiler>
  ) : (
    tr
  );
}

export const TaskRow = memo(TaskRowView);
