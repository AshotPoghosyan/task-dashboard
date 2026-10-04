import {
  mergeRequestCountsSchema,
  mergeRequestSchema,
  paginatedSchema,
  type MergeRequest,
  type MergeRequestFilters,
} from '@mrdash/shared';
import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api } from './client';

const mrPage = paginatedSchema(mergeRequestSchema);

export const mergeRequestsKey = ['merge-requests'] as const;
/** Kept apart from `mergeRequestsKey`: counts are not paged lists. */
export const mergeRequestCountsKey = ['merge-request-counts'] as const;

export type MrQuery = Pick<
  MergeRequestFilters,
  | 'provider'
  | 'repositoryId'
  | 'status'
  | 'authorId'
  | 'assigneeId'
  | 'reviewerId'
  | 'targetBranch'
  | 'q'
  | 'view'
  | 'me'
> & {
  /** `'1'` limits the list to the current user's merge requests (needs `me`). */
  mine?: '1';
  sort?: MergeRequestFilters['sort'];
  order?: MergeRequestFilters['order'];
};

export const useMergeRequests = (filters: MrQuery) =>
  useInfiniteQuery({
    queryKey: [...mergeRequestsKey, filters],
    queryFn: ({ pageParam }) =>
      api('/merge-requests', {
        query: { ...filters, limit: 100, cursor: pageParam },
        schema: mrPage,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    // Keep the old rows on screen while a new filter loads (no flashing).
    placeholderData: keepPreviousData,
  });

/** Tab badges; `filters` must not carry a status or view (every tab is one). */
export const useMergeRequestCounts = (filters: Omit<MrQuery, 'status' | 'view'>) =>
  useQuery({
    queryKey: [...mergeRequestCountsKey, filters],
    queryFn: () =>
      api('/merge-requests/counts', { query: filters, schema: mergeRequestCountsSchema }),
    placeholderData: keepPreviousData,
  });

export type { MergeRequest };
