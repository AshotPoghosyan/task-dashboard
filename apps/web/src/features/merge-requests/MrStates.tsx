import { AlertTriangle, CheckCircle2, GitPullRequest } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import { cn } from '../../lib/cn';
import { GRID, ROW_HEIGHT, SHOW } from './columns';

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
          className={cn('grid items-center gap-x-2 border-b border-border px-3', GRID)}
        >
          <Skeleton className={cn('h-4 w-4', SHOW.toggle)} />
          <Skeleton className={cn('h-4 w-24', SHOW.mr)} />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className={cn('h-4 w-24', SHOW.author)} />
          <Skeleton className={cn('h-5 w-16', SHOW.reviewers)} />
          <Skeleton className="h-5 w-16" />
          <Skeleton className={cn('h-4 w-16', SHOW.target)} />
          <Skeleton className={cn('h-4 w-10', SHOW.updated)} />
          <Skeleton className={cn('h-4 w-20', SHOW.linked)} />
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

interface EmptyProps {
  /** The Needs attention tab: an empty list is good news, not a missing result. */
  attention: boolean;
  filtered: boolean;
  onClear: () => void;
  onShowAll: () => void;
}

export function MrEmpty({ attention, filtered, onClear, onShowAll }: EmptyProps) {
  return (
    <div className="rounded-card border border-border bg-surface">
      {attention && !filtered ? (
        <EmptyState
          icon={<CheckCircle2 size={24} />}
          title="Nothing needs attention right now"
          description="No reviews waiting on you, no requested changes, and nothing stale."
          action={<Button onClick={onShowAll}>See all merge requests</Button>}
        />
      ) : (
        <EmptyState
          icon={<GitPullRequest size={24} />}
          title={filtered ? 'No merge requests match these filters' : 'No merge requests here yet'}
          description={
            filtered
              ? 'Try removing a filter or searching for something else.'
              : 'Merge requests appear here after the first sync of a repository.'
          }
          action={filtered ? <Button onClick={onClear}>Clear filters</Button> : undefined}
        />
      )}
    </div>
  );
}
