import type { MrStatus, PrismaClient, Provider } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { loadEnv } from '../config/env.js';
import { getPrisma } from '../db/prisma.js';

export function testEnv(overrides: Record<string, string> = {}) {
  return loadEnv({
    ...process.env,
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DASHBOARD_PASSWORD: '',
    ...overrides,
  });
}

export const makeApp = (overrides: Record<string, string> = {}): Promise<FastifyInstance> =>
  buildApp(testEnv(overrides));

export const prisma = (): PrismaClient => getPrisma();

let seq = 0;
const next = (): number => ++seq;

export function createRepo(provider: Provider = 'GITLAB', fullPath = `group/repo-${next()}`) {
  return prisma().repository.create({
    data: { provider, externalId: `ext-${next()}`, fullPath, webUrl: `https://x/${fullPath}` },
  });
}

export function createUser(username = `user${next()}`, provider: Provider = 'GITLAB') {
  return prisma().gitUser.create({
    data: { provider, externalId: `u-${next()}`, username, displayName: username.toUpperCase() },
  });
}

interface MrOptions {
  repositoryId: string;
  authorId: string;
  title?: string;
  status?: MrStatus;
  provider?: Provider;
  targetBranch?: string;
  assigneeId?: string;
  updatedAtRemote?: Date;
  createdAtRemote?: Date;
  mergedAt?: Date;
  closedAt?: Date;
  reviewerIds?: string[];
}

export function createMr(o: MrOptions) {
  const n = next();
  return prisma().mergeRequest.create({
    data: {
      repositoryId: o.repositoryId,
      provider: o.provider ?? 'GITLAB',
      externalId: `mr-${n}`,
      number: n,
      title: o.title ?? `MR ${n}`,
      status: o.status ?? 'OPEN',
      isDraft: o.status === 'DRAFT',
      sourceBranch: `feature/${n}`,
      targetBranch: o.targetBranch ?? 'main',
      url: `https://x/mr/${n}`,
      authorId: o.authorId,
      assigneeId: o.assigneeId ?? null,
      createdAtRemote: o.createdAtRemote ?? new Date('2026-01-01T00:00:00Z'),
      updatedAtRemote: o.updatedAtRemote ?? new Date('2026-01-01T00:00:00Z'),
      mergedAt: o.mergedAt ?? null,
      closedAt: o.closedAt ?? null,
      reviewers: o.reviewerIds
        ? { create: o.reviewerIds.map((gitUserId) => ({ gitUserId })) }
        : undefined,
    },
  });
}

/** Repo + author in one call, for tests that don't care about either. */
export async function baseFixtures() {
  const repo = await createRepo();
  const author = await createUser();
  return { repo, author };
}
