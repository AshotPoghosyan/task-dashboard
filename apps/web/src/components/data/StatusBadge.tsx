import { getStatusDisplay, type TaskStatus } from '@mrdash/shared';
import { CircleDashed } from 'lucide-react';
import { STATUS_ICONS } from '../../lib/icons';
import { cn } from '../../lib/cn';

/** Static class names so Tailwind can see them (tinted bg + colored text + 1px border). */
const TONE: Record<string, string> = {
  'status-merged': 'bg-status-merged/10 text-status-merged border-status-merged/30',
  'status-in-review': 'bg-status-in-review/10 text-status-in-review border-status-in-review/30',
  'status-open': 'bg-status-open/10 text-status-open border-status-open/30',
  'status-draft': 'bg-status-draft/10 text-status-draft border-status-draft/30',
  'status-closed': 'bg-status-closed/10 text-status-closed border-status-closed/30',
  'status-no-mr': 'bg-status-no-mr/10 text-status-no-mr border-status-no-mr/30',
};

export function StatusBadge({ status, className }: { status: TaskStatus; className?: string }) {
  const display = getStatusDisplay(status);
  const Icon = STATUS_ICONS[display.icon] ?? CircleDashed;
  return (
    <span
      data-status={status}
      className={cn(
        'inline-flex items-center gap-1 rounded-control border px-1.5 py-0.5 text-xs font-medium',
        TONE[display.colorToken],
        className,
      )}
    >
      <Icon size={12} aria-hidden="true" />
      {display.label}
    </span>
  );
}
