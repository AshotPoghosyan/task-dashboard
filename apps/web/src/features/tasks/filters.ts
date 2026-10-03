import { STATUS_DISPLAY, TASK_STATUSES, TASK_TYPES, type TaskStatus } from '@mrdash/shared';
import type { TaskQuery } from '../../api/tasks';
import type { Filters } from '../../hooks/useUrlFilters';
import type { FilterChip } from '../../components/data/FilterBar';

export const FILTER_KEYS = ['status', 'assignee', 'targetBranch', 'type'] as const;

export const STATUS_OPTIONS = TASK_STATUSES.map((s) => ({
  value: s,
  label: STATUS_DISPLAY[s].label,
}));
export const TYPE_OPTIONS = TASK_TYPES.map((t) => ({
  value: t,
  label: t.charAt(0) + t.slice(1).toLowerCase(),
}));

const OPEN_STATUSES: TaskStatus[] = ['DRAFT', 'OPEN', 'IN_REVIEW'];

/** Stat cards apply a status filter; "Merged today" narrows to MERGED (see DECISIONS.md). */
export const STAT_FILTERS = {
  open: OPEN_STATUSES,
  review: ['IN_REVIEW'],
  merged: ['MERGED'],
} as const satisfies Record<string, readonly TaskStatus[]>;

export const sameSet = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && b.every((x) => a.includes(x));

const LABELS: Record<string, string> = {
  status: 'Status',
  assignee: 'Assignee',
  targetBranch: 'Branch',
  type: 'Type',
};

const valueLabel = (key: string, value: string) =>
  key === 'status' ? (STATUS_DISPLAY[value as TaskStatus]?.label ?? value) : value;

export function buildChips(filters: Filters, search: string): FilterChip[] {
  const chips: FilterChip[] = [];
  if (search) chips.push({ key: 'q', label: 'Search', value: search });
  for (const key of FILTER_KEYS) {
    for (const value of filters[key] ?? []) {
      chips.push({ key, label: LABELS[key] ?? key, value: valueLabel(key, value) });
    }
  }
  return chips;
}

/** Chips show display labels; map a chip back to the raw URL value. */
export function rawValue(chip: FilterChip): string {
  if (chip.key !== 'status') return chip.value;
  return TASK_STATUSES.find((s) => STATUS_DISPLAY[s].label === chip.value) ?? chip.value;
}

export function toQuery(filters: Filters, search: string): TaskQuery {
  const pick = <T extends string>(k: string, allowed?: readonly T[]) => {
    const v = (filters[k] ?? []).filter(
      (x) => !allowed || (allowed as readonly string[]).includes(x),
    );
    return v.length ? (v as T[]) : undefined;
  };
  return {
    status: pick('status', TASK_STATUSES),
    type: pick('type', TASK_TYPES),
    assignee: pick('assignee'),
    targetBranch: pick('targetBranch'),
    q: search || undefined,
  };
}
