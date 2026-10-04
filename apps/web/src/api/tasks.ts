import {
  filterOptionsSchema,
  mergeRequestSchema,
  paginatedSchema,
  statsSchema,
  taskCountsSchema,
  taskSchema,
  type CreateTaskInput,
  type MergeRequestSummary,
  type TaskFilters,
  type UpdateTaskInput,
} from '@mrdash/shared';
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { useToast } from '../components/ui/Toast';
import { api } from './client';
import { optimisticPatch, taskCountsKey, tasksKey, type TaskPatch } from './taskCache';

const taskPage = paginatedSchema(taskSchema);
const mrPage = paginatedSchema(mergeRequestSchema);

export type TaskQuery = {
  status?: TaskFilters['status'];
  assignee?: TaskFilters['assignee'];
  targetBranch?: TaskFilters['targetBranch'];
  type?: TaskFilters['type'];
  q?: string | undefined;
  me?: string | undefined;
  sort?: TaskFilters['sort'];
  order?: TaskFilters['order'];
  /** `'1'` limits the list to the current user's tasks (needs `me`). */
  mine?: '1';
};

export const useTasks = (filters: TaskQuery) =>
  useInfiniteQuery({
    queryKey: [...tasksKey, filters],
    queryFn: ({ pageParam }) =>
      api('/tasks', { query: { ...filters, limit: 200, cursor: pageParam }, schema: taskPage }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
  });

/** Tab badges; `filters` must not carry a status (every tab is one). */
export const useTaskCounts = (filters: Omit<TaskQuery, 'status' | 'sort' | 'order'>) =>
  useQuery({
    queryKey: [...taskCountsKey, filters],
    queryFn: () => api('/tasks/counts', { query: filters, schema: taskCountsSchema }),
    placeholderData: keepPreviousData,
  });

export const useStats = () =>
  useQuery({ queryKey: ['stats'], queryFn: () => api('/stats', { schema: statsSchema }) });

export const useFilterOptions = () =>
  useQuery({
    queryKey: ['filter-options'],
    queryFn: () => api('/filters/options', { schema: filterOptionsSchema }),
  });

/** Searchable merge request list for the link picker. */
export const useMergeRequestSearch = (q: string, enabled: boolean) =>
  useQuery({
    queryKey: ['mr-search', q],
    queryFn: () => api('/merge-requests', { query: { q, limit: 20 }, schema: mrPage }),
    enabled,
    placeholderData: keepPreviousData,
  });

/** Task edits change stat counts and can add assignees/branches to the filter options. */
const invalidateTaskData = (qc: QueryClient) =>
  Promise.all(
    [tasksKey, taskCountsKey, ['stats'], ['filter-options']].map((queryKey) =>
      qc.invalidateQueries({ queryKey }),
    ),
  );

export function useCreateTask() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (input: CreateTaskInput) =>
      api('/tasks', { method: 'POST', body: input, schema: taskSchema }),
    onSuccess: (t) => toast({ title: 'Task created', description: t.title, tone: 'success' }),
    onError: (e) =>
      toast({ title: 'Could not create task', description: e.message, tone: 'error' }),
    onSettled: () => invalidateTaskData(qc),
  });
}

/** Shared shape for mutations that patch the cache first and roll back on failure. */
function useOptimistic<V>(
  request: (v: V) => Promise<unknown>,
  target: (v: V) => string,
  patch: (v: V) => TaskPatch,
  failure: string,
) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: request,
    onMutate: (v) => optimisticPatch(qc, target(v), patch(v)),
    onError: (e, _v, rollback) => {
      rollback?.();
      toast({ title: failure, description: e.message, tone: 'error' });
    },
    // Server recalculates status and sort; reconcile with the truth either way.
    onSettled: () => invalidateTaskData(qc),
  });
}

export const useUpdateTask = () =>
  useOptimistic<{ id: string; changes: UpdateTaskInput }>(
    ({ id, changes }) =>
      api(`/tasks/${id}`, { method: 'PATCH', body: changes, schema: taskSchema }),
    (v) => v.id,
    ({ changes }) =>
      (t) => {
        // Only display fields; parent and sort changes wait for the server.
        const { title, type, assigneeName, targetBranch, notes, statusOverride } = changes;
        const fields = { title, type, assigneeName, targetBranch, notes, statusOverride };
        const defined = Object.fromEntries(
          Object.entries(fields).filter(([, v]) => v !== undefined),
        );
        const next = { ...t, ...defined };
        if (changes.statusOverride) next.status = changes.statusOverride;
        return next;
      },
    'Could not save changes',
  );

export const useLinkMr = () =>
  useOptimistic<{ taskId: string; mr: MergeRequestSummary }>(
    ({ taskId, mr }) =>
      api(`/tasks/${taskId}/merge-requests`, {
        method: 'POST',
        body: { mergeRequestId: mr.id },
        schema: taskSchema,
      }),
    (v) => v.taskId,
    ({ mr }) =>
      (t) => ({
        ...t,
        mergeRequests: t.mergeRequests.some((m) => m.id === mr.id)
          ? t.mergeRequests
          : [...t.mergeRequests, mr],
      }),
    'Could not link merge request',
  );

export const useUnlinkMr = () =>
  useOptimistic<{ taskId: string; mrId: string }>(
    ({ taskId, mrId }) =>
      api(`/tasks/${taskId}/merge-requests/${mrId}`, { method: 'DELETE', schema: taskSchema }),
    (v) => v.taskId,
    ({ mrId }) =>
      (t) => ({ ...t, mergeRequests: t.mergeRequests.filter((m) => m.id !== mrId) }),
    'Could not unlink merge request',
  );
