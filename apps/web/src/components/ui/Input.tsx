import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

/** Callers must provide an accessible name (`aria-label` or an associated label). */
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          'h-8 w-full rounded-control border border-border bg-bg px-2 text-sm text-fg placeholder:text-fg-muted',
          className,
        )}
        {...rest}
      />
    );
  },
);
