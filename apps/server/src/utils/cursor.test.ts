import { describe, expect, it } from 'vitest';
import { decodeCursor, encodeCursor, paginate } from './cursor.js';
import { AppError } from './errors.js';

describe('cursor', () => {
  it('round-trips', () => {
    expect(decodeCursor(encodeCursor({ v: 'x', id: 'a' }))).toEqual({ v: 'x', id: 'a' });
  });

  it('rejects garbage with INVALID_CURSOR', () => {
    for (const bad of ['!!', Buffer.from('{}').toString('base64url')]) {
      expect(() => decodeCursor(bad)).toThrow(AppError);
    }
  });

  it('paginate returns a cursor only when more rows exist', () => {
    const rows = [1, 2, 3].map((n) => ({ n }));
    const cursorOf = (r: { n: number }) => ({ v: r.n, id: String(r.n) });
    expect(paginate(rows, 3, cursorOf).nextCursor).toBeNull();
    const page = paginate(rows, 2, cursorOf);
    expect(page.items).toHaveLength(2);
    expect(decodeCursor(page.nextCursor as string)).toEqual({ v: 2, id: '2' });
  });
});
