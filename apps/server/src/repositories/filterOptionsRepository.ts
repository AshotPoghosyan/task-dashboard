import { getPrisma } from '../db/prisma.js';

const names = (rows: { v: string | null }[]): string[] =>
  rows.map((r) => r.v).filter((v): v is string => !!v);

export async function distinctTaskAssignees(): Promise<string[]> {
  const rows = await getPrisma().task.findMany({
    where: { assigneeName: { not: null } },
    distinct: ['assigneeName'],
    select: { assigneeName: true },
    orderBy: { assigneeName: 'asc' },
  });
  return names(rows.map((r) => ({ v: r.assigneeName })));
}

export async function distinctBranches(): Promise<string[]> {
  const prisma = getPrisma();
  const [mrs, tasks] = await Promise.all([
    prisma.mergeRequest.groupBy({ by: ['targetBranch'] }),
    prisma.task.groupBy({ by: ['targetBranch'], where: { targetBranch: { not: null } } }),
  ]);
  const all = new Set([
    ...mrs.map((r) => r.targetBranch),
    ...names(tasks.map((r) => ({ v: r.targetBranch }))),
  ]);
  return [...all].sort();
}

export function listGitUsers() {
  return getPrisma().gitUser.findMany({
    select: {
      id: true,
      provider: true,
      externalId: true,
      username: true,
      displayName: true,
      avatarUrl: true,
    },
    orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
  });
}
