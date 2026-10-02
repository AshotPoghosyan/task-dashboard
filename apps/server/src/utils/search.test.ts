import { describe, expect, it } from 'vitest';
import { escapeLike } from './search.js';

describe('escapeLike', () => {
  it('escapes LIKE wildcards and backslashes', () => {
    expect(escapeLike('100%_done\\')).toBe('100\\%\\_done\\\\');
  });
  it('leaves plain text untouched', () => {
    expect(escapeLike('login bug')).toBe('login bug');
  });
});
