import { randomUUID } from 'node:crypto';
import type { MrStatus, Prisma, TaskStatus, TaskType } from '@prisma/client';
import { getEnv } from '../../config/env.js';
import { disconnectPrisma, getPrisma } from '../prisma.js';
import { resetDatabase } from './reset.js';
import {
  TARGET_BRANCHES,
  TITLE_NOUNS,
  TITLE_VERBS,
  createRng,
  mrTimes,
  pick,
  seedTaskStatus,
  startOfTodayInZone,
} from './common.js';

const MR_COUNT = 10_000;
const TASK_COUNT = 2_000;
const BATCH = 2_000;
const STATUSES: MrStatus[] = ['DRAFT', 'OPEN', 'IN_REVIEW', 'MERGED', 'CLOSED'];

async function insertBatched<T>(
  rows: T[],
  insert: (chunk: T[]) => Promise<unknown>,
): Promise<void> {
  for (let i = 0; i < rows.length; i += BATCH) await insert(rows.slice(i, i + BATCH));
}

export async function seedLarge(now: Date = new Date()): Promise<void> {
  const prisma = getPrisma();
  const rng = createRng(7);
  const todayStart = startOfTodayInZone(getEnv().APP_TIMEZONE, now);
  await resetDatabase(prisma);

  const repoIds = [randomUUID(), randomUUID(), randomUUID()];
  await prisma.repository.createMany({
    data: repoIds.map((id, i) => ({
      id,
      provider: i === 2 ? ('GITHUB' as const) : ('GITLAB' as const),
      externalId: i === 2 ? 'acme/large-web' : `${2000 + i}`,
      fullPath: `acme/large-${i}`,
      webUrl: `https://example.com/acme/large-${i}`,
    })),
  });

  const userIds = Array.from({ length: 50 }, () => randomUUID());
  await prisma.gitUser.createMany({
    data: userIds.map((id, i) => ({
      id,
      provider: 'GITLAB' as const,
      externalId: `lu-${i}`,
      username: `user${i}`,
      displayName: `User ${i}`,
    })),
  });

  const mrs: Prisma.MergeRequestCreateManyInput[] = [];
  const mrStatus = new Map<string, MrStatus>();
  for (let i = 0; i < MR_COUNT; i++) {
    const status = STATUSES[Math.floor(rng() * STATUSES.length)]!;
    const id = randomUUID();
    const repositoryId = repoIds[i % repoIds.length]!;
    const title = `${pick(rng, TITLE_VERBS)} ${pick(rng, TITLE_NOUNS)} #${i}`;
    mrStatus.set(id, status);
    mrs.push({
      id,
      repositoryId,
      provider: repositoryId === repoIds[2] ? 'GITHUB' : 'GITLAB',
      externalId: `${100_000 + i}`,
      number: Math.floor(i / repoIds.length) + 1,
      title,
      status,
      isDraft: status === 'DRAFT',
      sourceBranch: `feature/large-${i}`,
      targetBranch: pick(rng, TARGET_BRANCHES),
      url: `https://example.com/mr/${i}`,
      authorId: pick(rng, userIds),
      assigneeId: rng() < 0.8 ? pick(rng, userIds) : null,
      ...mrTimes(status, rng, now, status === 'MERGED' && rng() < 0.02, todayStart),
    });
  }
  await insertBatched(mrs, (data) => prisma.mergeRequest.createMany({ data }));

  const types: TaskType[] = ['FEATURE', 'TASK', 'BUG'];
  const mrIds = [...mrStatus.keys()];
  const tasks: Prisma.TaskCreateManyInput[] = [];
  const links: Prisma.TaskMergeRequestCreateManyInput[] = [];
  const topLevel = Math.floor(TASK_COUNT * 0.8);
  const parentIds: string[] = [];
  for (let i = 0; i < TASK_COUNT; i++) {
    const id = randomUUID();
    const isSub = i >= topLevel;
    const linked = rng() < 0.7 ? [...new Set([pick(rng, mrIds), pick(rng, mrIds)])] : [];
    for (const mergeRequestId of linked) links.push({ taskId: id, mergeRequestId });
    const status: TaskStatus = seedTaskStatus(linked.map((m) => mrStatus.get(m)!));
    if (!isSub) parentIds.push(id);
    tasks.push({
      id,
      title: `${pick(rng, TITLE_VERBS)} ${pick(rng, TITLE_NOUNS)} task ${i}`,
      type: isSub ? 'BUG' : pick(rng, types),
      status,
      assigneeName: `User ${Math.floor(rng() * 50)}`,
      targetBranch: pick(rng, TARGET_BRANCHES),
      parentId: isSub ? pick(rng, parentIds) : null,
      sortOrder: i,
    });
  }
  // Parents are inserted before sub-bugs (array order), so the self-FK is satisfied.
  await insertBatched(tasks, (data) => prisma.task.createMany({ data }));
  await insertBatched(links, (data) => prisma.taskMergeRequest.createMany({ data }));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const started = Date.now();
  seedLarge()
    .then(() =>
      process.stdout.write(
        `Large seed complete: ${MR_COUNT} MRs, ${TASK_COUNT} tasks in ${((Date.now() - started) / 1000).toFixed(1)}s\n`,
      ),
    )
    .catch((err: unknown) => {
      process.stderr.write(`Large seed failed: ${String(err)}\n`);
      process.exitCode = 1;
    })
    .finally(() => disconnectPrisma());
}
