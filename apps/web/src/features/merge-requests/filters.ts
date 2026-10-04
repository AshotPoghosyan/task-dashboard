import { PROVIDERS, type FilterOptions } from '@mrdash/shared';
import type { MrQuery } from '../../api/mergeRequests';
import type { FilterChip } from '../../components/data/FilterBar';
import type { FilterDef } from '../../components/data/MoreFilters';
import type { Filters } from '../../hooks/useUrlFilters';
import { tabQuery, type MrTab } from './tabs';

/** Secondary filters; they live behind "More filters". Status is the tab, search is the top bar. */
export const FILTER_KEYS = [
  'provider',
  'repositoryId',
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
    authorId: users,
    assigneeId: users,
    reviewerId: users,
    targetBranch: (data?.branches ?? []).map((b) => ({ value: b, label: b })),
  };
}

export const filterDefs = (options: Record<string, Option[]>): FilterDef[] =>
  FILTER_KEYS.map((key) => ({ key, label: FILTER_LABELS[key], options: options[key] ?? [] }));

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

interface QueryParts {
  tab: MrTab;
  /** Git user id of the current user, when known. */
  me: string | undefined;
  mine: boolean;
}

/** The filter part of the query: no status or view, so it also serves the tab counts. */
export function toFilterQuery(
  filters: Filters,
  search: string,
  { me, mine }: Pick<QueryParts, 'me' | 'mine'>,
): Omit<MrQuery, 'status' | 'view'> {
  const pick = <T extends string>(key: string, allowed?: readonly T[]) => {
    const v = (filters[key] ?? []).filter(
      (x) => !allowed || (allowed as readonly string[]).includes(x),
    );
    return v.length ? (v as T[]) : undefined;
  };
  return {
    provider: pick('provider', PROVIDERS),
    repositoryId: pick('repositoryId'),
    authorId: pick('authorId'),
    assigneeId: pick('assigneeId'),
    reviewerId: pick('reviewerId'),
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
): MrQuery => ({
  ...toFilterQuery(filters, search, parts),
  ...tabQuery(parts.tab),
  ...(parts.tab === 'attention' ? {} : { sort: 'updatedAt' as const, order }),
});

export const hasActiveFilters = (filters: Filters, search: string, mine: boolean) =>
  mine || search !== '' || FILTER_KEYS.some((k) => (filters[k] ?? []).length > 0);
