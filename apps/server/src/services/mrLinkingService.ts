import type { Repository } from '@prisma/client';
import type { NormalizedMR } from '../providers/types.js';
import type { Db } from '../repositories/db.js';
import { findMergeRequestByNumber } from '../repositories/mergeRequestSyncRepository.js';
import {
  createTask,
  findChildLinkedToMr,
  findTaskCore,
  linkMr,
  lockTasks,
  taskIdsLinkedToMr,
} from '../repositories/taskRepository.js';
import { parseLinkHints } from '../utils/linkHints.js';

/**
 * Applies the directives in an MR description and returns the ids of tasks it touched.
 * - `Task: #<id>` links the MR to that task.
 * - `Parent: !<n>` / `Parent: #<n>` puts a BUG sub-task for this MR under the task linked to the
 *   parent MR (tasks nest one level only, so a sub-bug parent resolves to its own parent).
 * Safe to repeat: webhooks are redelivered and edited descriptions are re-applied.
 */
export async function applyLinkHints(
  db: Db,
  repo: Repository,
  mergeRequestId: string,
  mr: NormalizedMR,
): Promise<string[]> {
  const hints = parseLinkHints(mr.description, repo.provider);
  const touched: string[] = [];

  if (hints.taskId && (await findTaskCore(hints.taskId, db))) {
    await linkMr(hints.taskId, mergeRequestId, db);
    touched.push(hints.taskId);
  }

  if (hints.parentNumber !== null && hints.parentNumber !== mr.number) {
    const parentMr = await findMergeRequestByNumber(db, repo.id, hints.parentNumber);
    const link = parentMr ? (await taskIdsLinkedToMr(parentMr.id, db))[0] : undefined;
    const linked = link ? await findTaskCore(link.taskId, db) : null;
    if (linked) {
      const topId = linked.parentId ?? linked.id;
      await lockTasks([topId], db);
      if (!(await findChildLinkedToMr(topId, mergeRequestId, db))) {
        const child = await createTask(
          {
            title: mr.title,
            type: 'BUG',
            parentId: topId,
            assigneeName: mr.assignee?.displayName ?? null,
            targetBranch: mr.targetBranch,
          },
          db,
        );
        await linkMr(child.id, mergeRequestId, db);
        touched.push(child.id);
      }
    }
  }
  return touched;
}
