import type { MrStatus, Prisma, ReviewerState } from '@prisma/client';
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

const MR_STATUSES: MrStatus[] = ['DRAFT', 'OPEN', 'IN_REVIEW', 'MERGED', 'CLOSED'];
const USERS = ['ani', 'armen', 'lilit', 'davit', 'mariam', 'tigran', 'narek', 'sona'];

export async function seed(now: Date = new Date()): Promise<void> {
  const prisma = getPrisma();
  const rng = createRng(42);
  const todayStart = startOfTodayInZone(getEnv().APP_TIMEZONE, now);
  await resetDatabase(prisma);

  const repos = await Promise.all([
    prisma.repository.create({
      data: {
        provider: 'GITLAB',
        externalId: '1001',
        fullPath: 'acme/backend',
        webUrl: 'https://gitlab.com/acme/backend',
        defaultBranch: 'main',
      },
    }),
    prisma.repository.create({
      data: {
        provider: 'GITHUB',
        externalId: 'acme/frontend',
        fullPath: 'acme/frontend',
        webUrl: 'https://github.com/acme/frontend',
        defaultBranch: 'develop',
      },
    }),
  ]);

  const users = await Promise.all(
    USERS.map((username, i) => {
      const provider = i % 2 === 0 ? 'GITLAB' : 'GITHUB';
      return prisma.gitUser.create({
        data: {
          provider,
          externalId: `u-${i + 1}`,
          username,
          displayName: username.charAt(0).toUpperCase() + username.slice(1),
          avatarUrl: null, // initials fallback in the UI; seed data uses no external URLs
        },
      });
    }),
  );

  const mrIds: { id: string; status: MrStatus }[] = [];
  const reviewerStates: ReviewerState[] = ['REQUESTED', 'APPROVED', 'CHANGES_REQUESTED'];
  for (let i = 0; i < 40; i++) {
    const repo = repos[i % 2]!;
    const status = MR_STATUSES[i % MR_STATUSES.length]!;
    // Three of the merged MRs land "today" in the app timezone.
    const mergedToday = status === 'MERGED' && Math.floor(i / MR_STATUSES.length) < 3;
    const times = mrTimes(status, rng, now, mergedToday, todayStart);
    const author = pick(rng, users);
    const reviewerPool = users.filter((u) => u.id !== author.id);
    const reviewerCount =
      status === 'IN_REVIEW' || status === 'MERGED' ? 1 + Math.floor(rng() * 3) : 0;
    const reviewers: Prisma.MergeRequestReviewerCreateWithoutMergeRequestInput[] = reviewerPool
      .slice(0, reviewerCount)
      .map((u, idx) => ({
        gitUser: { connect: { id: u.id } },
        state: status === 'MERGED' ? 'APPROVED' : reviewerStates[(i + idx) % 3]!,
      }));
    const title = `${pick(rng, TITLE_VERBS)} ${pick(rng, TITLE_NOUNS)}`;
    const mr = await prisma.mergeRequest.create({
      data: {
        repositoryId: repo.id,
        provider: repo.provider,
        externalId: `${5000 + i}`,
        number: i + 1,
        title,
        description: `${title}.\n\nSeeded merge request #${i + 1}.`,
        status,
        isDraft: status === 'DRAFT',
        sourceBranch: `feature/${title.toLowerCase().replace(/\W+/g, '-')}-${i + 1}`,
        targetBranch: pick(rng, TARGET_BRANCHES),
        url: `${repo.webUrl}/merge_requests/${i + 1}`,
        authorId: author.id,
        assigneeId: i % 5 === 0 ? null : pick(rng, users).id,
        ...times,
        reviewers: { create: reviewers },
      },
    });
    mrIds.push({ id: mr.id, status });
  }

  // 12 tasks: 8 top-level, 4 sub-bugs. Tasks 0-5 link to MRs; the rest have none.
  const taskTypes = ['FEATURE', 'TASK', 'BUG'] as const;
  const parents = [];
  for (let i = 0; i < 8; i++) {
    const linked = i < 6 ? [mrIds[i * 3]!, mrIds[i * 3 + 1]!].slice(0, 1 + (i % 2)) : [];
    const task = await prisma.task.create({
      data: {
        title: `${pick(rng, TITLE_VERBS)} ${pick(rng, TITLE_NOUNS)}`,
        type: taskTypes[i % 3]!,
        status: seedTaskStatus(linked.map((m) => m.status)),
        assigneeName: pick(rng, USERS),
        targetBranch: pick(rng, TARGET_BRANCHES),
        notes: i % 2 === 0 ? 'Needs QA sign-off before release.' : null,
        sortOrder: i,
        mergeRequests: { create: linked.map((m) => ({ mergeRequestId: m.id })) },
      },
    });
    parents.push(task);
  }
  for (let i = 0; i < 4; i++) {
    const parent = parents[i]!;
    const linked = [mrIds[20 + i]!];
    await prisma.task.create({
      data: {
        title: `Bug: ${pick(rng, TITLE_NOUNS)} regression`,
        type: 'BUG',
        status: seedTaskStatus(linked.map((m) => m.status)),
        assigneeName: pick(rng, USERS),
        targetBranch: parent.targetBranch,
        parentId: parent.id,
        sortOrder: i,
        mergeRequests: { create: linked.map((m) => ({ mergeRequestId: m.id })) },
      },
    });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seed()
    .then(() => process.stdout.write('Seed complete: 2 repos, 8 users, 40 MRs, 12 tasks\n'))
    .catch((err: unknown) => {
      process.stderr.write(`Seed failed: ${String(err)}\n`);
      process.exitCode = 1;
    })
    .finally(() => disconnectPrisma());
}
