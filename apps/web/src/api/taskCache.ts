import type { Task } from '@mrdash/shared';
import type { InfiniteData, QueryClient } from '@tanstack/react-query';

export interface TaskPage {
  items: Task[];
  nextCursor: string | null;
}
type Node = Task | Task['children'][number];
export type TaskPatch = (task: Node) => Node;

export const tasksKey = ['tasks'] as const;
const LIST = { queryKey: tasksKey } as const;

function mapPages(data: InfiniteData<TaskPage>, id: string, patch: TaskPatch) {
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.map((t) => {
        if (t.id === id) return patch(t) as Task;
        if (!t.children.some((c) => c.id === id)) return t;
        return {
          ...t,
          children: t.children.map((c) => (c.id === id ? patch(c) : c)) as Task['children'],
        };
      }),
    })),
  };
}

type Snapshot = [readonly unknown[], InfiniteData<TaskPage> | undefined][];

/** Applies `patch` to one task (or sub-bug) in every cached task list; returns a rollback. */
export async function optimisticPatch(qc: QueryClient, id: string, patch: TaskPatch) {
  await qc.cancelQueries(LIST);
  const snapshot: Snapshot = qc.getQueriesData<InfiniteData<TaskPage>>(LIST);
  qc.setQueriesData<InfiniteData<TaskPage>>(LIST, (data) => data && mapPages(data, id, patch));
  return () => {
    for (const [key, data] of snapshot) qc.setQueryData(key, data);
  };
}
