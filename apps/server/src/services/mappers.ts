import type { GitUser, MergeRequest, SubTask, Task } from '@mrdash/shared';
import type { MergeRequestRow } from '../repositories/mergeRequestRepository.js';
import type { TaskRow } from '../repositories/taskRepository.js';

type TaskCore = Omit<TaskRow, 'children'>;

export function toSubTask(row: TaskCore): SubTask {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    status: row.status,
    statusOverride: row.statusOverride,
    assigneeName: row.assigneeName,
    targetBranch: row.targetBranch,
    notes: row.notes,
    parentId: row.parentId,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    mergeRequests: row.mergeRequests.map((l) => l.mergeRequest),
  };
}

export function toTask(row: TaskRow): Task {
  return { ...toSubTask(row), children: row.children.map(toSubTask) };
}

export function toMergeRequest(row: MergeRequestRow): MergeRequest {
  return {
    id: row.id,
    repositoryId: row.repositoryId,
    provider: row.provider,
    externalId: row.externalId,
    number: row.number,
    title: row.title,
    description: row.description,
    status: row.status,
    isDraft: row.isDraft,
    sourceBranch: row.sourceBranch,
    targetBranch: row.targetBranch,
    url: row.url,
    author: row.author satisfies GitUser,
    assignee: row.assignee,
    reviewers: row.reviewers.map((r) => ({ user: r.gitUser, state: r.state })),
    createdAtRemote: row.createdAtRemote.toISOString(),
    updatedAtRemote: row.updatedAtRemote.toISOString(),
    mergedAt: row.mergedAt?.toISOString() ?? null,
    closedAt: row.closedAt?.toISOString() ?? null,
  };
}
