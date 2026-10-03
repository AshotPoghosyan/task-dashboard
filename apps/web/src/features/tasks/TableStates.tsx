import { AlertTriangle, ListChecks } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import { cn } from '../../lib/cn';
import { GRID } from './columns';
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
          className={cn('grid items-center gap-3 border-b border-border px-3', GRID)}
        >
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="hidden h-4 w-24 lg:block" />
          <Skeleton className="hidden h-4 w-16 lg:block" />
          <Skeleton className="hidden h-4 w-20 lg:block" />
          <Skeleton className="hidden h-4 w-20 lg:block" />
          <Skeleton className="hidden h-4 w-16 lg:block" />
          <Skeleton className="hidden h-4 w-16 lg:block" />
          <Skeleton className="hidden h-4 w-32 lg:block" />
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
            <Button onClick={onClear}>Clear filters</Button>
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
