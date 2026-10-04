import type { MergeRequestSummary } from '@mrdash/shared';
import { createColumnHelper } from '@tanstack/react-table';
import { ChevronRight, ExternalLink } from 'lucide-react';
import { Avatar } from '../../components/data/Avatar';
import { StatusBadge } from '../../components/data/StatusBadge';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/Popover';
import { cn } from '../../lib/cn';
import { formatDateTime, relativeAge } from '../../lib/datetime';
import { hasChildren, shortId, type TaskNode } from './rows';

const col = createColumnHelper<TaskNode>();

/**
 * Grid template shared by header, body rows and skeletons. Columns are hidden in this order as
 * the screen narrows: Type and Linked MRs (< 1024px), Assignee and Updated (< 768px). Everything
 * hidden is in the details drawer, which opens when a row is clicked.
 * DOM order: ID, Title, Type, Assignee, Status, Linked MRs, Updated.
 */
export const GRID = [
  'grid-cols-[6.5rem_minmax(0,1fr)_6.5rem]',
  'md:grid-cols-[6.5rem_minmax(0,1fr)_9rem_6.5rem_5.5rem]',
  'lg:grid-cols-[6.5rem_minmax(0,1fr)_5rem_9rem_6.5rem_6rem_5.5rem]',
].join(' ');
export const SHOW = {
  type: 'hidden lg:block',
  assignee: 'hidden md:block',
  linked: 'hidden lg:block',
  updated: 'hidden md:block',
} as const;

export const mrLabel = (m: MergeRequestSummary) =>
  `${m.provider === 'GITLAB' ? '!' : '#'}${m.number}`;

function Muted({ children }: { children: React.ReactNode }) {
  return <span className="text-fg-muted">{children}</span>;
}

/** Count of linked MRs; opens a popover listing them (without opening the row's drawer). */
function LinkedMrs({ mrs }: { mrs: MergeRequestSummary[] }) {
  if (mrs.length === 0) return <Muted>–</Muted>;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="tabular rounded-control bg-raised px-1.5 py-0.5 text-xs hover:text-accent"
        >
          {mrs.length} {mrs.length === 1 ? 'MR' : 'MRs'}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <h2 className="mb-2 text-xs font-medium text-fg-secondary">Linked merge requests</h2>
        <ul className="flex flex-col gap-2">
          {mrs.map((m) => (
            <li key={m.id} className="flex items-center gap-2 text-sm">
              <StatusBadge status={m.status} />
              <a
                href={m.url}
                target="_blank"
                rel="noreferrer"
                className="flex min-w-0 items-center gap-1 hover:underline"
              >
                <span className="tabular text-fg-secondary">{mrLabel(m)}</span>
                <span className="truncate">{m.title}</span>
                <ExternalLink size={12} aria-hidden="true" className="shrink-0" />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
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
        <span className="truncate text-fg" title={getValue()}>
          {getValue()}
        </span>
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
    meta: { className: SHOW.type },
    cell: ({ getValue }) => (
      <span className="text-xs capitalize text-fg-secondary">{getValue().toLowerCase()}</span>
    ),
  }),
  col.accessor('assigneeName', {
    header: 'Assignee',
    meta: { className: SHOW.assignee },
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
  col.accessor('mergeRequests', {
    header: 'Linked MRs',
    meta: { className: SHOW.linked },
    cell: ({ getValue }) => <LinkedMrs mrs={getValue()} />,
  }),
  col.accessor('updatedAt', {
    header: 'Updated',
    meta: { className: SHOW.updated },
    cell: ({ getValue }) => (
      <time
        dateTime={getValue()}
        title={formatDateTime(getValue())}
        className="tabular text-xs text-fg-secondary"
      >
        {relativeAge(getValue())}
      </time>
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
