import type { Provider } from '@prisma/client';
import type { NormalizedMR, NormalizedUser } from '../providers/types.js';
import type { Db } from './db.js';

async function upsertUsers(
  db: Db,
  provider: Provider,
  users: NormalizedUser[],
): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const u of users) {
    if (ids.has(u.externalId)) continue;
    const data = { username: u.username, displayName: u.displayName, avatarUrl: u.avatarUrl };
    const row = await db.gitUser.upsert({
      where: { provider_externalId: { provider, externalId: u.externalId } },
      create: { provider, externalId: u.externalId, ...data },
      update: u.partial ? {} : data,
      select: { id: true },
    });
    ids.set(u.externalId, row.id);
  }
  return ids;
}

/**
 * Upserts users, merge requests and reviewers for one batch. Safe to repeat: rows are keyed on
 * (provider, externalId) and (repositoryId, number). Returns the ids of the upserted MRs.
 */
export async function upsertMergeRequestBatch(
  db: Db,
  repo: { id: string; provider: Provider },
  batch: NormalizedMR[],
): Promise<string[]> {
  const people = batch.flatMap((mr) => [
    mr.author,
    ...(mr.assignee ? [mr.assignee] : []),
    ...mr.reviewers.map((r) => r.user),
  ]);
  const userIds = await upsertUsers(db, repo.provider, people);
  const userId = (u: NormalizedUser): string => userIds.get(u.externalId) as string; // set above

  const mrIds: string[] = [];
  for (const mr of batch) {
    const data = {
      provider: repo.provider,
      externalId: mr.externalId,
      title: mr.title,
      description: mr.description,
      status: mr.status,
      isDraft: mr.isDraft,
      sourceBranch: mr.sourceBranch,
      targetBranch: mr.targetBranch,
      url: mr.url,
      authorId: userId(mr.author),
      assigneeId: mr.assignee ? userId(mr.assignee) : null,
      createdAtRemote: mr.createdAtRemote,
      updatedAtRemote: mr.updatedAtRemote,
      mergedAt: mr.mergedAt,
      closedAt: mr.closedAt,
    };
    const row = await db.mergeRequest.upsert({
      where: { repositoryId_number: { repositoryId: repo.id, number: mr.number } },
      create: { repositoryId: repo.id, number: mr.number, ...data },
      update: data,
      select: { id: true },
    });
    await db.mergeRequestReviewer.deleteMany({ where: { mergeRequestId: row.id } });
    if (mr.reviewers.length > 0) {
      await db.mergeRequestReviewer.createMany({
        data: mr.reviewers.map((r) => ({
          mergeRequestId: row.id,
          gitUserId: userId(r.user),
          state: r.state,
        })),
        skipDuplicates: true,
      });
    }
    mrIds.push(row.id);
  }
  return mrIds;
}

/** Existing MR with its reviewers, for webhook processing. */
export function findMergeRequestByNumber(db: Db, repositoryId: string, number: number) {
  return db.mergeRequest.findUnique({
    where: { repositoryId_number: { repositoryId, number } },
    select: {
      id: true,
      updatedAtRemote: true,
      reviewers: { select: { state: true, gitUser: true } },
    },
  });
}
