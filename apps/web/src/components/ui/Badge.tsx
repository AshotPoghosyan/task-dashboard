import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export function Badge({ className, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'tabular inline-flex items-center gap-1 rounded-control border border-border bg-raised px-1.5 py-0.5 text-xs font-medium text-fg-secondary',
        className,
      )}
      {...rest}
    />
  );
}
