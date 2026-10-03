import type { MergeRequestSummary } from '@mrdash/shared';
import { createColumnHelper } from '@tanstack/react-table';
import { ChevronRight } from 'lucide-react';
import { Avatar } from '../../components/data/Avatar';
import { StatusBadge } from '../../components/data/StatusBadge';
import { cn } from '../../lib/cn';
import { formatDate } from '../../lib/datetime';
import { hasChildren, shortId, type TaskNode } from './rows';

const col = createColumnHelper<TaskNode>();

/** Grid template shared by header, body rows and skeletons. Low-priority columns drop on small screens. */
export const GRID =
  'grid-cols-[7rem_minmax(12rem,1fr)_6.5rem] lg:grid-cols-[7rem_minmax(14rem,1fr)_5.5rem_9rem_6.5rem_8rem_9rem_7rem_7rem_12rem]';
const LOW = 'hidden lg:block';

const mrLabel = (m: MergeRequestSummary) => `${m.provider === 'GITLAB' ? '!' : '#'}${m.number}`;

function Muted({ children }: { children: React.ReactNode }) {
  return <span className="text-fg-muted">{children}</span>;
}

export const columns = [
  col.display({
    id: 'id',
    header: 'ID',
    cell: ({ row }) => {
      const task = row.original;
      const count = hasChildren(task) ? task.children.length : 0;
      return (
        <span className="flex items-center gap-1">
          {count > 0 ? (
            <button
              type="button"
              aria-expanded={row.getIsExpanded()}
              aria-label={`${row.getIsExpanded() ? 'Collapse' : 'Expand'} ${task.title}`}
              onClick={(e) => {
                e.stopPropagation();
                row.toggleExpanded();
              }}
              className="rounded-control p-0.5 text-fg-secondary hover:bg-raised hover:text-fg"
            >
              <ChevronRight
                size={14}
                aria-hidden="true"
                className={cn('transition-transform', row.getIsExpanded() && 'rotate-90')}
              />
            </button>
          ) : (
            <span className="w-[18px]" />
          )}
          <span className="tabular font-mono text-xs text-fg-secondary">{shortId(task.id)}</span>
        </span>
      );
    },
  }),
  col.accessor('title', {
    header: 'Title',
    cell: ({ row, getValue }) => (
      <span className="flex min-w-0 items-center gap-2">
        <span className="truncate text-fg">{getValue()}</span>
        {hasChildren(row.original) ? (
          <span
            title={`${row.original.children.length} sub-bugs`}
            className="tabular shrink-0 rounded-full border border-border bg-raised px-1.5 text-xs text-fg-secondary"
          >
            <span className="sr-only">Sub-bugs: </span>
            {row.original.children.length}
          </span>
        ) : null}
      </span>
    ),
  }),
  col.accessor('type', {
    header: 'Type',
    meta: { className: LOW },
    cell: ({ getValue }) => (
      <span className="text-xs capitalize text-fg-secondary">{getValue().toLowerCase()}</span>
    ),
  }),
  col.accessor('assigneeName', {
    header: 'Assignee',
    meta: { className: LOW },
    cell: ({ getValue }) => {
      const name = getValue();
      return name ? (
        <span className="flex items-center gap-2">
          <Avatar name={name} size={20} />
          <span className="truncate">{name}</span>
        </span>
      ) : (
        <Muted>Unassigned</Muted>
      );
    },
  }),
  col.accessor('status', {
    header: 'Status',
    cell: ({ getValue }) => <StatusBadge status={getValue()} />,
  }),
  col.accessor('targetBranch', {
    header: 'Target branch',
    meta: { className: LOW },
    cell: ({ getValue }) => <span className="truncate font-mono text-xs">{getValue() ?? '–'}</span>,
  }),
  col.accessor('mergeRequests', {
    header: 'Linked MRs',
    meta: { className: LOW },
    cell: ({ getValue }) => {
      const mrs = getValue();
      if (mrs.length === 0) return <Muted>–</Muted>;
      return (
        <span className="flex items-center gap-1 text-xs">
          {mrs.slice(0, 2).map((m) => (
            <span key={m.id} title={m.title} className="tabular rounded-control bg-raised px-1">
              {mrLabel(m)}
            </span>
          ))}
          {mrs.length > 2 ? <span className="text-fg-secondary">+{mrs.length - 2}</span> : null}
        </span>
      );
    },
  }),
  col.accessor('createdAt', {
    header: 'Created',
    meta: { className: LOW },
    cell: ({ getValue }) => <span className="tabular text-xs">{formatDate(getValue())}</span>,
  }),
  col.display({
    id: 'merged',
    header: 'Merged',
    meta: { className: LOW },
    cell: ({ row }) =>
      row.original.status === 'MERGED' ? (
        <span className="tabular text-xs">{formatDate(row.original.updatedAt)}</span>
      ) : (
        <Muted>–</Muted>
      ),
  }),
  col.accessor('notes', {
    header: 'Notes',
    meta: { className: LOW },
    cell: ({ getValue }) => (
      <span className="truncate text-xs text-fg-secondary">{getValue() ?? ''}</span>
    ),
  }),
];

declare module '@tanstack/react-table' {
  // The generics must match the library declaration even though they are unused here.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    className?: string;
  }
}
