import * as RPopover from '@radix-ui/react-popover';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export const Popover = RPopover.Root;
export const PopoverTrigger = RPopover.Trigger;

export function PopoverContent({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <RPopover.Portal>
      <RPopover.Content
        align="start"
        sideOffset={6}
        className={cn(
          'z-50 rounded-card border border-border bg-raised p-3 text-sm text-fg',
          className,
        )}
      >
        {children}
      </RPopover.Content>
    </RPopover.Portal>
  );
}
