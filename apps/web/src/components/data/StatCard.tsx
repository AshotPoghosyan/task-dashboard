import { Card } from '../ui/Card';
import { Skeleton } from '../ui/Skeleton';
import { cn } from '../../lib/cn';

interface StatCardProps {
  label: string;
  value?: number;
  secondary?: string;
  loading?: boolean;
  onClick?: () => void;
  active?: boolean;
}

export function StatCard({ label, value, secondary, loading, onClick, active }: StatCardProps) {
  const body = (
    <>
      <div className="text-xs font-medium text-fg-secondary">{label}</div>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-16" />
      ) : (
        <div className="tabular mt-1 text-2xl font-semibold text-fg">{value ?? '–'}</div>
      )}
      {secondary ? <div className="mt-1 text-xs text-fg-muted">{secondary}</div> : null}
    </>
  );
  if (!onClick) return <Card>{body}</Card>;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active ?? false}
      className={cn(
        'rounded-card border bg-surface p-4 text-left hover:bg-raised',
        active ? 'border-accent' : 'border-border',
      )}
    >
      {body}
    </button>
  );
}
