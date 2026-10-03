import * as RDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export const Dialog = RDialog.Root;
export const DialogTrigger = RDialog.Trigger;
export const DialogClose = RDialog.Close;

interface PanelProps {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

function CloseButton() {
  return (
    <RDialog.Close
      aria-label="Close"
      className="rounded-control p-1 text-fg-secondary hover:bg-surface hover:text-fg"
    >
      <X size={16} aria-hidden="true" />
    </RDialog.Close>
  );
}

function Panel({ title, description, children, className }: PanelProps) {
  return (
    <RDialog.Portal>
      <RDialog.Overlay className="fixed inset-0 z-40 bg-bg/70" />
      <RDialog.Content
        {...(description ? {} : { 'aria-describedby': undefined })}
        className={cn('fixed z-50 border border-border bg-raised text-fg', className)}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border p-4">
          <div>
            <RDialog.Title className="text-sm font-semibold">{title}</RDialog.Title>
            {description ? (
              <RDialog.Description className="mt-1 text-sm text-fg-secondary">
                {description}
              </RDialog.Description>
            ) : null}
          </div>
          <CloseButton />
        </div>
        <div className="p-4">{children}</div>
      </RDialog.Content>
    </RDialog.Portal>
  );
}

export function DialogContent(props: PanelProps) {
  return (
    <Panel
      {...props}
      className={cn(
        'left-1/2 top-1/2 w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-card',
        props.className,
      )}
    />
  );
}

/** Side drawer; `side` picks the edge it slides from. */
export function DrawerContent({
  side = 'right',
  ...props
}: PanelProps & { side?: 'left' | 'right' }) {
  return (
    <Panel
      {...props}
      className={cn(
        'inset-y-0 w-[min(28rem,100vw)] overflow-y-auto',
        side === 'right' ? 'right-0 border-y-0 border-r-0' : 'left-0 border-y-0 border-l-0',
        props.className,
      )}
    />
  );
}
export const Drawer = RDialog.Root;
export const DrawerTrigger = RDialog.Trigger;
