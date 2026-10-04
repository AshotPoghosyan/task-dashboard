import { TASK_TYPES } from '@mrdash/shared';
import type { TaskQuery } from '../../api/tasks';
import type { FilterChip } from '../../components/data/FilterBar';
import type { FilterDef } from '../../components/data/MoreFilters';
import type { Filters } from '../../hooks/useUrlFilters';
import { tabStatus, type TaskTab } from './tabs';

/** Secondary filters behind "More filters". Status is the tab, search is the top bar. */
export const FILTER_KEYS = ['assignee', 'targetBranch', 'type'] as const;

export const TYPE_OPTIONS = TASK_TYPES.map((t) => ({
  value: t,
  label: t.charAt(0) + t.slice(1).toLowerCase(),
}));

const LABELS: Record<(typeof FILTER_KEYS)[number], string> = {
  assignee: 'Assignee',
  targetBranch: 'Target branch',
  type: 'Type',
};

const asOptions = (values: string[]) => values.map((v) => ({ value: v, label: v }));

export const filterDefs = (data?: { assignees: string[]; branches: string[] }): FilterDef[] => [
  { key: 'assignee', label: LABELS.assignee, options: asOptions(data?.assignees ?? []) },
  { key: 'targetBranch', label: LABELS.targetBranch, options: asOptions(data?.branches ?? []) },
  { key: 'type', label: LABELS.type, options: TYPE_OPTIONS },
];

export function buildChips(filters: Filters, search: string): FilterChip[] {
  const chips: FilterChip[] = [];
  if (search) chips.push({ key: 'q', label: 'Search', value: search });
  for (const key of FILTER_KEYS) {
    for (const raw of filters[key] ?? []) {
      const value =
        key === 'type' ? (TYPE_OPTIONS.find((o) => o.value === raw)?.label ?? raw) : raw;
      chips.push({ key, label: LABELS[key], value, raw });
    }
  }
  return chips;
}

interface QueryParts {
  tab: TaskTab;
  me: string | undefined;
  mine: boolean;
}

/** The filter part of the query: no status, so it also serves the tab counts. */
export function toFilterQuery(
  filters: Filters,
  search: string,
  { me, mine }: Pick<QueryParts, 'me' | 'mine'>,
): TaskQuery {
  const pick = <T extends string>(k: string, allowed?: readonly T[]) => {
    const v = (filters[k] ?? []).filter(
      (x) => !allowed || (allowed as readonly string[]).includes(x),
    );
    return v.length ? (v as T[]) : undefined;
  };
  return {
    type: pick('type', TASK_TYPES),
    assignee: pick('assignee'),
    targetBranch: pick('targetBranch'),
    q: search || undefined,
    me,
    mine: mine && me ? '1' : undefined,
  };
}

export const toQuery = (
  filters: Filters,
  search: string,
  parts: QueryParts,
  order: 'asc' | 'desc',
): TaskQuery => ({
  ...toFilterQuery(filters, search, parts),
  status: tabStatus(parts.tab),
  sort: 'updatedAt',
  order,
});

export const hasActiveFilters = (filters: Filters, search: string, mine: boolean, tab: TaskTab) =>
  mine || tab !== 'all' || search !== '' || FILTER_KEYS.some((k) => (filters[k] ?? []).length > 0);
