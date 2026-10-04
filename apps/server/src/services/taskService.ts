import type { CreateTaskInput, Task, UpdateTaskInput } from '@mrdash/shared';
import { aggregateTaskStatus } from '@mrdash/shared';
import type { Db } from '../repositories/db.js';
import { inTransaction } from '../repositories/db.js';
import { mergeRequestExists } from '../repositories/mergeRequestRepository.js';
import {
  createTask as insertTask,
  deleteTask as removeTask,
  findTaskById,
  findTaskCore,
  linkMr,
  lockTasks,
  unlinkMr,
  updateTask as patchTask,
} from '../repositories/taskRepository.js';
import { AppError } from '../utils/errors.js';
import { toTask } from './mappers.js';
import { recalculateTaskStatus } from './taskStatusService.js';

export async function getTask(id: string): Promise<Task> {
  const row = await findTaskById(id);
  if (!row) throw AppError.notFound('Task');
  return toTask(row);
}

/** Enforces max one nesting level for `taskId` (undefined when creating) under `parentId`. */
async function assertValidParent(
  parentId: string,
  taskId: string | undefined,
  db: Db,
): Promise<void> {
  // Serialise concurrent re-parenting so two requests cannot create a 2-level tree.
  await lockTasks(taskId ? [parentId, taskId] : [parentId], db);
  if (parentId === taskId) {
    throw AppError.unprocessable('INVALID_PARENT', 'A task cannot be its own parent');
  }
  const parent = await findTaskCore(parentId, db);
  if (!parent) throw AppError.unprocessable('PARENT_NOT_FOUND', 'Parent task not found');
  if (parent.parentId) {
    throw AppError.unprocessable(
      'NESTING_TOO_DEEP',
      'A sub-bug cannot have children (max one level of nesting)',
    );
  }
  if (taskId) {
    const self = await findTaskCore(taskId, db);
    if (self && self._count.children > 0) {
      throw AppError.unprocessable(
        'NESTING_TOO_DEEP',
        'A task with sub-bugs cannot become a sub-bug itself',
      );
    }
  }
}

/** `actorId` is the signed-in user making the change (null for password logins and scripts). */
export async function createTask(
  input: CreateTaskInput,
  actorId: string | null = null,
): Promise<Task> {
  const id = await inTransaction(async (db) => {
    if (input.parentId) await assertValidParent(input.parentId, undefined, db);
    const override = input.statusOverride ?? null;
    const created = await insertTask(
      {
        title: input.title,
        type: input.type,
        assigneeName: input.assigneeName ?? null,
        targetBranch: input.targetBranch ?? null,
        notes: input.notes ?? null,
        parentId: input.parentId ?? null,
        statusOverride: override,
        status: aggregateTaskStatus(override, []),
        updatedById: actorId,
      },
      db,
    );
    return created.id;
  });
  return getTask(id);
}

export async function updateTask(
  id: string,
  input: UpdateTaskInput,
  actorId: string | null = null,
): Promise<Task> {
  await inTransaction(async (db) => {
    if (!(await findTaskCore(id, db))) throw AppError.notFound('Task');
    if (input.parentId) await assertValidParent(input.parentId, id, db);
    await patchTask(id, { ...input, updatedById: actorId }, db);
    if (input.statusOverride !== undefined) await recalculateTaskStatus(id, db);
  });
  return getTask(id);
}

export async function deleteTask(id: string): Promise<void> {
  await inTransaction(async (db) => {
    if (!(await findTaskCore(id, db))) throw AppError.notFound('Task');
    await removeTask(id, db);
  });
}

export async function linkMergeRequest(
  taskId: string,
  mergeRequestId: string,
  actorId: string | null = null,
): Promise<Task> {
  await inTransaction(async (db) => {
    if (!(await findTaskCore(taskId, db))) throw AppError.notFound('Task');
    if (!(await mergeRequestExists(mergeRequestId, db))) throw AppError.notFound('Merge request');
    await linkMr(taskId, mergeRequestId, db);
    if (actorId) await patchTask(taskId, { updatedById: actorId }, db);
    await recalculateTaskStatus(taskId, db);
  });
  return getTask(taskId);
}

export async function unlinkMergeRequest(
  taskId: string,
  mergeRequestId: string,
  actorId: string | null = null,
): Promise<Task> {
  await inTransaction(async (db) => {
    if (!(await findTaskCore(taskId, db))) throw AppError.notFound('Task');
    if (!(await unlinkMr(taskId, mergeRequestId, db))) {
      throw AppError.notFound('Merge request link');
    }
    if (actorId) await patchTask(taskId, { updatedById: actorId }, db);
    await recalculateTaskStatus(taskId, db);
  });
  return getTask(taskId);
}
