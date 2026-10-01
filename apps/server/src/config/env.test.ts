import { describe, expect, it } from 'vitest';
import { parseEnv } from './env.js';

describe('parseEnv', () => {
  it('applies defaults and treats empty strings as unset', () => {
    const env = parseEnv({ DATABASE_URL: 'postgresql://x', SESSION_SECRET: '' });
    expect(env.PORT).toBe(4000);
    expect(env.SESSION_SECRET).toBeUndefined();
  });

  it('fails fast when required vars are missing', () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
  });
});
