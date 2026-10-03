import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, icon, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center gap-2 px-6 py-12 text-center', className)}>
      {icon ? (
        <div className="text-fg-muted" aria-hidden="true">
          {icon}
        </div>
      ) : null}
      <h3 className="text-sm font-medium text-fg">{title}</h3>
      {description ? <p className="max-w-sm text-sm text-fg-secondary">{description}</p> : null}
      {action}
    </div>
  );
}
