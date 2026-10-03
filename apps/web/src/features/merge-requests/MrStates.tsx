import { AlertTriangle, GitPullRequest } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import { cn } from '../../lib/cn';
import { GRID, LOW, ROW_HEIGHT } from './columns';

/** Same grid and row height as the table so nothing shifts when data arrives. */
export function MrSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div
      role="status"
      aria-label="Loading merge requests"
      className="min-h-0 flex-1 overflow-hidden rounded-card border border-border bg-surface"
    >
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          style={{ height: ROW_HEIGHT }}
          className={cn('grid items-center gap-3 border-b border-border px-3', GRID)}
        >
          <Skeleton className="h-4 w-4" />
          <Skeleton className={cn('h-4 w-24', LOW)} />
          <Skeleton className={cn('h-4 w-10', LOW)} />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className={cn('h-4 w-24', LOW)} />
          <Skeleton className={cn('h-5 w-16', LOW)} />
          <Skeleton className="h-5 w-16" />
          <Skeleton className={cn('h-4 w-32', LOW)} />
          <Skeleton className={cn('h-4 w-10', LOW)} />
          <Skeleton className={cn('h-4 w-24', LOW)} />
        </div>
      ))}
    </div>
  );
}

export function MrError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-card border border-border bg-surface">
      <EmptyState
        icon={<AlertTriangle size={24} />}
        title="Could not load merge requests"
        description={message}
        action={<Button onClick={onRetry}>Retry</Button>}
      />
    </div>
  );
}

export function MrEmpty({ filtered, onClear }: { filtered: boolean; onClear: () => void }) {
  return (
    <div className="rounded-card border border-border bg-surface">
      <EmptyState
        icon={<GitPullRequest size={24} />}
        title={filtered ? 'No merge requests match these filters' : 'No merge requests yet'}
        description={
          filtered
            ? 'Try removing a filter or searching for something else.'
            : 'Merge requests appear here after the first sync of a repository.'
        }
        action={filtered ? <Button onClick={onClear}>Clear filters</Button> : undefined}
      />
    </div>
  );
}
