import {
  mergeRequestSchema,
  paginatedSchema,
  type MergeRequest,
  type MergeRequestFilters,
} from '@mrdash/shared';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { api } from './client';

const mrPage = paginatedSchema(mergeRequestSchema);

export const mergeRequestsKey = ['merge-requests'] as const;

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
>;

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

export type { MergeRequest };
