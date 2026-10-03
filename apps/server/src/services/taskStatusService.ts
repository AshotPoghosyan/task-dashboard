import { aggregateTaskStatus } from '@mrdash/shared';
import type { Db } from '../repositories/db.js';
import {
  findTaskCore,
  linkedMrStatuses,
  setTaskStatus,
  taskIdsLinkedToMr,
} from '../repositories/taskRepository.js';

/** Recomputes and stores a task's status from its override and linked MRs. */
export async function recalculateTaskStatus(taskId: string, db: Db): Promise<void> {
  const task = await findTaskCore(taskId, db);
  if (!task) return;
  const statuses = (await linkedMrStatuses(taskId, db)).map((m) => m.status);
  await setTaskStatus(taskId, aggregateTaskStatus(task.statusOverride, statuses), db);
}

/** Call inside the transaction that changes a merge request (sync, webhooks). */
export async function recalculateTasksForMergeRequest(
  mergeRequestId: string,
  db: Db,
): Promise<string[]> {
  const links = await taskIdsLinkedToMr(mergeRequestId, db);
  for (const { taskId } of links) await recalculateTaskStatus(taskId, db);
  return links.map((l) => l.taskId);
}
