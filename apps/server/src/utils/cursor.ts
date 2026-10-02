import { z } from 'zod';
import { AppError } from './errors.js';

/** Opaque keyset cursor: the sort value of the last row plus its id as tie-breaker. */
const cursorSchema = z.object({ v: z.union([z.string(), z.number()]), id: z.string() });
export type Cursor = z.infer<typeof cursorSchema>;

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

export function decodeCursor(raw: string): Cursor {
  try {
    return cursorSchema.parse(JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')));
  } catch {
    throw AppError.badRequest('INVALID_CURSOR', 'Invalid pagination cursor');
  }
}

/**
 * Splits a `limit + 1` fetch into the page and its next cursor.
 * `cursorOf` maps the last returned row to its cursor.
 */
export function paginate<T>(
  rows: T[],
  limit: number,
  cursorOf: (row: T) => Cursor,
): { items: T[]; nextCursor: string | null } {
  if (rows.length <= limit) return { items: rows, nextCursor: null };
  const items = rows.slice(0, limit);
  return { items, nextCursor: encodeCursor(cursorOf(items[limit - 1] as T)) };
}
