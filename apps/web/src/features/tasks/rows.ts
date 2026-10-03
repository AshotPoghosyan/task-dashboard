import type { SubTask, Task } from '@mrdash/shared';

export type TaskNode = Task | SubTask;

export const hasChildren = (t: TaskNode): t is Task => 'children' in t && t.children.length > 0;

/** TanStack `getSubRows`: sub-bugs nest one level under their task. */
export const getSubRows = (t: TaskNode): TaskNode[] | undefined =>
  'children' in t ? t.children : undefined;

/** Short display id (ids are long cuids). */
export const shortId = (id: string) => id.slice(-6).toUpperCase();

export function allExpanded(tasks: Task[]): Record<string, boolean> {
  return Object.fromEntries(tasks.filter(hasChildren).map((t) => [t.id, true]));
}

/** Visible node ids in display order, used for keyboard navigation. */
export function visibleIds(tasks: Task[], expanded: Record<string, boolean>): string[] {
  return tasks.flatMap((t) => [t.id, ...(expanded[t.id] ? t.children.map((c) => c.id) : [])]);
}

export function findNode(tasks: Task[], id: string | null): TaskNode | undefined {
  if (!id) return undefined;
  for (const t of tasks) {
    if (t.id === id) return t;
    const child = t.children.find((c) => c.id === id);
    if (child) return child;
  }
  return undefined;
}
