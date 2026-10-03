import { describe, expect, it } from 'vitest';
import { listMatches } from './accessPolicy.js';

const id = (username: string, email: string | null = null) => ({
  externalId: '1',
  username,
  email,
  displayName: username,
  avatarUrl: null,
});

describe('listMatches', () => {
  it('matches username or email, case-insensitively (entries arrive lower-cased)', () => {
    expect(listMatches(['ann'], 'GITHUB', id('Ann'))).toBe(true);
    expect(listMatches(['ann@x.io'], 'GITLAB', id('zed', 'Ann@X.io'))).toBe(true);
    expect(listMatches(['bob'], 'GITHUB', id('ann'))).toBe(false);
    expect(listMatches([], 'GITHUB', id('ann'))).toBe(false);
  });

  it('scopes provider-prefixed entries to that provider', () => {
    expect(listMatches(['github:ann'], 'GITHUB', id('ann'))).toBe(true);
    expect(listMatches(['github:ann'], 'GITLAB', id('ann'))).toBe(false);
    expect(listMatches(['gitlab:ann@x.io'], 'GITLAB', id('zed', 'ann@x.io'))).toBe(true);
  });

  it('does not treat a partial match as a match', () => {
    expect(listMatches(['ann'], 'GITHUB', id('annabel'))).toBe(false);
  });
});
