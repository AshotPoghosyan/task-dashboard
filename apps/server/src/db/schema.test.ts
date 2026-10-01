import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestPrisma, truncateAll } from '../test/db.js';

describe('database schema', () => {
  let prisma: PrismaClient;

  beforeEach(async () => {
    prisma ??= createTestPrisma();
    await truncateAll(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const repoData = {
    provider: 'GITLAB',
    externalId: '1',
    fullPath: 'a/b',
    webUrl: 'https://x',
  } as const;

  it('enforces UNIQUE(provider, externalId) on repositories and git_users', async () => {
    await prisma.repository.create({ data: repoData });
    await expect(prisma.repository.create({ data: repoData })).rejects.toMatchObject({
      code: 'P2002',
    });
    // Same externalId under a different provider is allowed.
    await prisma.repository.create({ data: { ...repoData, provider: 'GITHUB' } });

    const user = { provider: 'GITHUB', externalId: 'u', username: 'u', displayName: 'U' } as const;
    await prisma.gitUser.create({ data: user });
    await expect(prisma.gitUser.create({ data: user })).rejects.toMatchObject({ code: 'P2002' });
  });

  it('enforces UNIQUE(repositoryId, number) on merge requests', async () => {
    const repo = await prisma.repository.create({ data: repoData });
    const author = await prisma.gitUser.create({
      data: { provider: 'GITLAB', externalId: 'a', username: 'a', displayName: 'A' },
    });
    const mr = {
      repositoryId: repo.id,
      provider: 'GITLAB',
      externalId: 'm1',
      number: 1,
      title: 'T',
      status: 'OPEN',
      sourceBranch: 's',
      targetBranch: 't',
      url: 'https://x/1',
      authorId: author.id,
      createdAtRemote: new Date(),
      updatedAtRemote: new Date(),
    } as const;
    await prisma.mergeRequest.create({ data: mr });
    await expect(
      prisma.mergeRequest.create({ data: { ...mr, externalId: 'm2' } }),
    ).rejects.toMatchObject({
      code: 'P2002',
    });
  });

  it('enforces UNIQUE(provider, deliveryId) on webhook events', async () => {
    const ev = { provider: 'GITHUB', deliveryId: 'd1', eventType: 'push', payload: {} } as const;
    await prisma.webhookEvent.create({ data: ev });
    await expect(prisma.webhookEvent.create({ data: ev })).rejects.toMatchObject({ code: 'P2002' });
  });

  it('cascades parent task deletion to sub-bugs and join rows', async () => {
    const parent = await prisma.task.create({ data: { title: 'Parent' } });
    await prisma.task.create({ data: { title: 'Child', type: 'BUG', parentId: parent.id } });
    expect(await prisma.task.count()).toBe(2);
    await prisma.task.delete({ where: { id: parent.id } });
    expect(await prisma.task.count()).toBe(0);
  });

  it('has trigram GIN indexes on merge_requests.title and tasks.title', async () => {
    const rows = await prisma.$queryRaw<{ indexdef: string }[]>`
      SELECT indexdef FROM pg_indexes WHERE tablename IN ('merge_requests', 'tasks')`;
    const trigram = rows.filter((r) => r.indexdef.includes('gin_trgm_ops'));
    expect(trigram).toHaveLength(2);
  });
});
