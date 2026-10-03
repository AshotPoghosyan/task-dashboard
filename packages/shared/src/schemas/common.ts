import { z } from 'zod';

export const DEFAULT_PAGE_LIMIT = 50;
export const MAX_PAGE_LIMIT = 200;

export const paginationQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).default(DEFAULT_PAGE_LIMIT),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export const pageInfoSchema = z.object({
  nextCursor: z.string().nullable(),
});

/** Builds `{ items, nextCursor }` for a list endpoint. */
export const paginatedSchema = <T extends z.ZodType>(item: T) =>
  z.object({ items: z.array(item), nextCursor: z.string().nullable() });

export const errorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ErrorResponse = z.infer<typeof errorResponseSchema>;

/** Accepts `a,b`, repeated params (`['a','b']`) or a single value; yields a string array. */
export const multiValue = <T extends z.ZodType>(item: T) =>
  z.preprocess((v) => {
    if (v === undefined || v === '') return undefined;
    const parts = Array.isArray(v) ? v : [v];
    return parts
      .flatMap((p) => (typeof p === 'string' ? p.split(',') : [p]))
      .filter((p) => p !== '');
  }, z.array(item).optional());

export const idParamSchema = z.object({ id: z.string().min(1) });
export const taskMergeRequestParamSchema = z.object({
  id: z.string().min(1),
  mrId: z.string().min(1),
});
