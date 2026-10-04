import { AlertTriangle, ListChecks } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import { cn } from '../../lib/cn';
import { GRID, SHOW } from './columns';
import { ROW_HEIGHT } from './TaskRow';

/** Same grid and row height as the table so nothing shifts when data arrives. */
export function TableSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div
      role="status"
      aria-label="Loading tasks"
      className="min-h-0 flex-1 overflow-hidden rounded-card border border-border bg-surface"
    >
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          style={{ height: ROW_HEIGHT }}
          className={cn('grid items-center gap-x-2 border-b border-border px-3', GRID)}
        >
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className={cn('h-4 w-12', SHOW.type)} />
          <Skeleton className={cn('h-4 w-24', SHOW.assignee)} />
          <Skeleton className="h-5 w-16" />
          <Skeleton className={cn('h-4 w-12', SHOW.linked)} />
          <Skeleton className={cn('h-4 w-10', SHOW.updated)} />
        </div>
      ))}
    </div>
  );
}

export function TableError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-card border border-border bg-surface">
      <EmptyState
        icon={<AlertTriangle size={24} />}
        title="Could not load tasks"
        description={message}
        action={<Button onClick={onRetry}>Retry</Button>}
      />
    </div>
  );
}

export function TableEmpty({
  filtered,
  onClear,
  onCreate,
}: {
  /** Some tab, filter or search is narrowing the list. */
  filtered: boolean;
  onClear: () => void;
  onCreate: () => void;
}) {
  return (
    <div className="rounded-card border border-border bg-surface">
      <EmptyState
        icon={<ListChecks size={24} />}
        title={filtered ? 'No tasks match these filters' : 'No tasks yet'}
        description={
          filtered
            ? 'Try removing a filter or searching for something else.'
            : 'Create your first task to start tracking merge requests.'
        }
        action={
          filtered ? (
            <Button onClick={onClear}>Show all tasks</Button>
          ) : (
            <Button variant="primary" onClick={onCreate}>
              New task
            </Button>
          )
        }
      />
    </div>
  );
}
