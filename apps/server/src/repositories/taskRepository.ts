import { Prisma, type MrStatus, type TaskStatus } from '@prisma/client';
import { getPrisma } from '../db/prisma.js';
import type { Db } from './db.js';

const mrSummarySelect = {
  mergeRequest: {
    select: { id: true, provider: true, number: true, title: true, status: true, url: true },
  },
} satisfies Prisma.TaskMergeRequestSelect;

const childOrder = [
  { sortOrder: 'asc' },
  { id: 'asc' },
] satisfies Prisma.TaskOrderByWithRelationInput[];

const editorSelect = { select: { id: true, displayName: true } } as const;

export const taskInclude = {
  mergeRequests: { select: mrSummarySelect, orderBy: { createdAt: 'asc' } },
  updatedBy: editorSelect,
  children: {
    orderBy: childOrder,
    include: {
      mergeRequests: { select: mrSummarySelect, orderBy: { createdAt: 'asc' } },
      updatedBy: editorSelect,
    },
  },
} satisfies Prisma.TaskInclude;

export type TaskRow = Prisma.TaskGetPayload<{ include: typeof taskInclude }>;

export function findTaskById(id: string, db: Db = getPrisma()): Promise<TaskRow | null> {
  return db.task.findUnique({ where: { id }, include: taskInclude });
}

/** Top-level tasks, ordered by (sortOrder, id), after the keyset position `after`. */
export function listTopLevelTasks(
  where: Prisma.TaskWhereInput,
  after: { sortOrder: number; id: string } | null,
  take: number,
): Promise<TaskRow[]> {
  const keyset: Prisma.TaskWhereInput = after
    ? {
        OR: [
          { sortOrder: { gt: after.sortOrder } },
          { sortOrder: after.sortOrder, id: { gt: after.id } },
        ],
      }
    : {};
  return getPrisma().task.findMany({
    where: { AND: [where, keyset] },
    orderBy: childOrder,
    take,
    include: taskInclude,
  });
}

export function createTask(data: Prisma.TaskUncheckedCreateInput, db: Db): Promise<{ id: string }> {
  return db.task.create({ data, select: { id: true } });
}

export function updateTask(
  id: string,
  data: Prisma.TaskUncheckedUpdateInput,
  db: Db,
): Promise<{ id: string }> {
  return db.task.update({ where: { id }, data, select: { id: true } });
}

export async function deleteTask(id: string, db: Db): Promise<void> {
  await db.task.delete({ where: { id } });
}

export function setTaskStatus(id: string, status: TaskStatus, db: Db): Promise<unknown> {
  return db.task.update({ where: { id }, data: { status }, select: { id: true } });
}

export function findTaskCore(
  id: string,
  db: Db,
): Promise<{
  id: string;
  parentId: string | null;
  statusOverride: TaskStatus | null;
  _count: { children: number };
} | null> {
  return db.task.findUnique({
    where: { id },
    select: {
      id: true,
      parentId: true,
      statusOverride: true,
      _count: { select: { children: true } },
    },
  });
}

export function linkedMrStatuses(taskId: string, db: Db): Promise<{ status: MrStatus }[]> {
  return db.mergeRequest.findMany({
    where: { tasks: { some: { taskId } } },
    select: { status: true },
  });
}

export function taskIdsLinkedToMr(mergeRequestId: string, db: Db): Promise<{ taskId: string }[]> {
  return db.taskMergeRequest.findMany({ where: { mergeRequestId }, select: { taskId: true } });
}

export async function linkMr(taskId: string, mergeRequestId: string, db: Db): Promise<void> {
  await db.taskMergeRequest.upsert({
    where: { taskId_mergeRequestId: { taskId, mergeRequestId } },
    create: { taskId, mergeRequestId },
    update: {},
  });
}

/** Returns true when a link existed and was removed. */
export async function unlinkMr(taskId: string, mergeRequestId: string, db: Db): Promise<boolean> {
  const { count } = await db.taskMergeRequest.deleteMany({ where: { taskId, mergeRequestId } });
  return count > 0;
}

/** Row-locks the given tasks (in a stable order, to avoid deadlocks) until the transaction ends. */
export async function lockTasks(ids: string[], db: Db): Promise<void> {
  const sorted = [...new Set(ids)].sort();
  await db.$queryRaw`SELECT id FROM tasks WHERE id IN (${Prisma.join(sorted)}) ORDER BY id FOR UPDATE`;
}

/** A sub-task of `parentId` that is linked to the merge request, if any. */
export function findChildLinkedToMr(
  parentId: string,
  mergeRequestId: string,
  db: Db,
): Promise<{ id: string } | null> {
  return db.task.findFirst({
    where: { parentId, mergeRequests: { some: { mergeRequestId } } },
    select: { id: true },
  });
}
