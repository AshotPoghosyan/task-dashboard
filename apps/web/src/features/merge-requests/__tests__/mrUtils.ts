import type { MergeRequest } from '@mrdash/shared';

export const user = (id: string, displayName: string) => ({
  id,
  provider: 'GITLAB' as const,
  externalId: id,
  username: id,
  displayName,
  avatarUrl: null,
});

export function makeMr(id: string, over: Partial<MergeRequest> = {}): MergeRequest {
  return {
    id,
    repositoryId: 'r1',
    provider: 'GITLAB',
    externalId: id,
    number: 12,
    title: `MR ${id}`,
    description: null,
    status: 'OPEN',
    isDraft: false,
    sourceBranch: 'feat/x',
    targetBranch: 'main',
    url: 'https://example.com/mr',
    author: user('u1', 'Ada Lovelace'),
    assignee: null,
    reviewers: [{ user: user('u2', 'Grace Hopper'), state: 'APPROVED' }],
    createdAtRemote: '2026-10-01T10:00:00.000Z',
    updatedAtRemote: '2026-10-01T10:00:00.000Z',
    mergedAt: null,
    closedAt: null,
    tasks: [{ id: 't1', title: 'Ship login' }],
    ...over,
  };
}
