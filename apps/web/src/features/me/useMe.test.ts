import type { GitUser } from '@mrdash/shared';
import { matchGitUser } from './useMe';

const user = (id: string, provider: GitUser['provider'], username: string): GitUser => ({
  id,
  provider,
  externalId: id,
  username,
  displayName: username,
  avatarUrl: null,
});

describe('matchGitUser', () => {
  const users = [
    user('1', 'GITHUB', 'Ada'),
    user('2', 'GITLAB', 'ada'),
    user('3', 'GITHUB', 'bob'),
  ];

  it('matches on provider and username, ignoring case', () => {
    expect(matchGitUser(users, { provider: 'GITHUB', username: 'ada' })?.id).toBe('1');
    expect(matchGitUser(users, { provider: 'GITLAB', username: 'ADA' })?.id).toBe('2');
  });

  it('returns null when nobody matches', () => {
    expect(matchGitUser(users, { provider: 'GITLAB', username: 'bob' })).toBeNull();
  });
});
