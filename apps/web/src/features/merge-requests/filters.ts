import { MR_STATUSES, PROVIDERS, STATUS_DISPLAY, type FilterOptions } from '@mrdash/shared';
import type { MrQuery } from '../../api/mergeRequests';
import type { FilterChip } from '../../components/data/FilterBar';
import type { Filters } from '../../hooks/useUrlFilters';

export const FILTER_KEYS = [
  'provider',
  'repositoryId',
  'status',
  'authorId',
  'assigneeId',
  'reviewerId',
  'targetBranch',
] as const;

export interface Option {
  value: string;
  label: string;
}

const PROVIDER_LABELS: Record<(typeof PROVIDERS)[number], string> = {
  GITLAB: 'GitLab',
  GITHUB: 'GitHub',
};

export const FILTER_LABELS: Record<(typeof FILTER_KEYS)[number], string> = {
  provider: 'Provider',
  repositoryId: 'Repository',
  status: 'Status',
  authorId: 'Author',
  assigneeId: 'Assignee',
  reviewerId: 'Reviewer',
  targetBranch: 'Target branch',
};

/** Dropdown options per filter key, derived from `/api/filters/options`. */
export function optionsByKey(data?: FilterOptions): Record<string, Option[]> {
  const users = (data?.users ?? []).map((u) => ({ value: u.id, label: u.displayName }));
  return {
    provider: PROVIDERS.map((p) => ({ value: p, label: PROVIDER_LABELS[p] })),
    repositoryId: (data?.repositories ?? []).map((r) => ({ value: r.id, label: r.fullPath })),
    status: MR_STATUSES.map((s) => ({ value: s, label: STATUS_DISPLAY[s].label })),
    authorId: users,
    assigneeId: users,
    reviewerId: users,
    targetBranch: (data?.branches ?? []).map((b) => ({ value: b, label: b })),
  };
}

export function buildChips(
  filters: Filters,
  search: string,
  options: Record<string, Option[]>,
): FilterChip[] {
  const chips: FilterChip[] = [];
  if (search) chips.push({ key: 'q', label: 'Search', value: search });
  for (const key of FILTER_KEYS) {
    for (const raw of filters[key] ?? []) {
      const label = options[key]?.find((o) => o.value === raw)?.label ?? raw;
      chips.push({ key, label: FILTER_LABELS[key], value: label, raw });
    }
  }
  return chips;
}

export function toQuery(filters: Filters, search: string): MrQuery {
  const pick = <T extends string>(key: string, allowed?: readonly T[]) => {
    const v = (filters[key] ?? []).filter(
      (x) => !allowed || (allowed as readonly string[]).includes(x),
    );
    return v.length ? (v as T[]) : undefined;
  };
  return {
    provider: pick('provider', PROVIDERS),
    status: pick('status', MR_STATUSES),
    repositoryId: pick('repositoryId'),
    authorId: pick('authorId'),
    assigneeId: pick('assigneeId'),
    reviewerId: pick('reviewerId'),
    targetBranch: pick('targetBranch'),
    q: search || undefined,
  };
}

export const hasActiveFilters = (filters: Filters, search: string) =>
  search !== '' || FILTER_KEYS.some((k) => (filters[k] ?? []).length > 0);
