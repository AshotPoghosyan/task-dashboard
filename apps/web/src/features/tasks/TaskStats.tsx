import { useStats } from '../../api/tasks';
import { StatCard } from '../../components/data/StatCard';
import type { Filters } from '../../hooks/useUrlFilters';
import { sameSet, STAT_FILTERS } from './filters';

interface Props {
  filters: Filters;
  /** Replaces the status filter; selecting an already-active card clears it. */
  onStatus: (status: string[]) => void;
}

export function TaskStats({ filters, onStatus }: Props) {
  const { data, isPending } = useStats();
  const current = filters.status ?? [];
  const card = (label: string, value: number | undefined, statuses: readonly string[]) => {
    const active = sameSet(current, statuses);
    return (
      <StatCard
        label={label}
        value={value}
        loading={isPending}
        active={active}
        onClick={() => onStatus(active ? [] : [...statuses])}
      />
    );
  };
  return (
    <section aria-label="Statistics" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {card('Total Open MRs', data?.openMrs, STAT_FILTERS.open)}
      {card('Pending Reviews', data?.pendingReviews, STAT_FILTERS.review)}
      {card('Merged Today', data?.mergedToday, STAT_FILTERS.merged)}
    </section>
  );
}
