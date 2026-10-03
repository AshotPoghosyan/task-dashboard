import type { MrStatus } from '@mrdash/shared';
import { useStats } from '../../api/tasks';
import { StatCard } from '../../components/data/StatCard';
import type { Filters } from '../../hooks/useUrlFilters';

interface Props {
  filters: Filters;
  /** Replaces the status filter; selecting an already-active card clears it. */
  onStatus: (status: string[]) => void;
}

export function MrStats({ filters, onStatus }: Props) {
  const { data, isPending } = useStats();
  const current = filters.status ?? [];
  const card = (label: string, value: number | undefined, status: MrStatus, secondary?: string) => {
    const active = current.length === 1 && current[0] === status;
    return (
      <StatCard
        label={label}
        value={value}
        secondary={secondary}
        loading={isPending}
        active={active}
        onClick={() => onStatus(active ? [] : [status])}
      />
    );
  };
  // `openMrs` counts draft + open + in review; the cards show each status separately.
  const open = data ? data.openMrs - data.draft - data.pendingReviews : undefined;
  return (
    <section aria-label="Statistics" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      {card('Draft', data?.draft, 'DRAFT')}
      {card('Open', open, 'OPEN')}
      {card('In review', data?.pendingReviews, 'IN_REVIEW')}
      {card('Merged today', data?.mergedToday, 'MERGED')}
      {card('Closed this week', data?.closedThisWeek, 'CLOSED')}
    </section>
  );
}
