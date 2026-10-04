import { useStats } from '../../api/tasks';
import { StatCard } from '../../components/data/StatCard';
import type { TaskTab } from './tabs';

interface Props {
  tab: TaskTab;
  /** Clicking a card switches to the matching status tab; clicking the active one goes back to All. */
  onTab: (tab: TaskTab) => void;
}

export function TaskStats({ tab, onTab }: Props) {
  const { data, isPending } = useStats();
  const card = (label: string, value: number | undefined, target: TaskTab) => (
    <StatCard
      label={label}
      value={value}
      loading={isPending}
      active={tab === target}
      onClick={() => onTab(tab === target ? 'all' : target)}
    />
  );
  return (
    <section aria-label="Statistics" className="grid grid-cols-3 gap-3">
      {card('Open MRs', data?.openMrs, 'open')}
      {card('Pending reviews', data?.pendingReviews, 'in-review')}
      {card('Merged today', data?.mergedToday, 'merged')}
    </section>
  );
}
