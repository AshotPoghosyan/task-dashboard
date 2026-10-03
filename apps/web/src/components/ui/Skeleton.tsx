import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export function Skeleton({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'animate-[skeleton-pulse_1.5s_ease-in-out_infinite] rounded-control bg-raised',
        className,
      )}
      {...rest}
    />
  );
}
