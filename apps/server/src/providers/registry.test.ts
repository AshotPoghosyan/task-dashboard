import { describe, expect, it } from 'vitest';
import { createProviderRegistry } from './registry.js';

const base = { GITLAB_BASE_URL: 'https://gitlab.example', GITLAB_TOKEN: '', GITHUB_TOKEN: '' };

describe('createProviderRegistry', () => {
  it('omits providers without a token', () => {
    expect(createProviderRegistry(base)).toEqual({});
  });

  it('registers only providers that have a token', () => {
    const r = createProviderRegistry({ ...base, GITHUB_TOKEN: 't' });
    expect(Object.keys(r)).toEqual(['GITHUB']);
    expect(
      Object.keys(createProviderRegistry({ ...base, GITLAB_TOKEN: 't', GITHUB_TOKEN: 't' })),
    ).toEqual(['GITLAB', 'GITHUB']);
  });
});
