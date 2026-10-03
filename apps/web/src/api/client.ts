import { errorResponseSchema } from '@mrdash/shared';
import type { z } from 'zod';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type Query = Record<string, string | string[] | number | undefined>;

export function buildQuery(query?: Query): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === '') continue;
    const str = Array.isArray(value) ? value.join(',') : String(value);
    if (str) params.set(key, str);
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

interface RequestOptions<S extends z.ZodType> {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  query?: Query;
  body?: unknown;
  /** Response schema; the response is validated and typed from it. */
  schema: S;
}

export async function api<S extends z.ZodType>(
  path: string,
  { method = 'GET', query, body, schema }: RequestOptions<S>,
): Promise<z.infer<S>> {
  const res = await fetch(`/api${path}${buildQuery(query)}`, {
    method,
    credentials: 'include',
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  const json: unknown = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const parsed = errorResponseSchema.safeParse(json);
    throw parsed.success
      ? new ApiError(res.status, parsed.data.error.code, parsed.data.error.message)
      : new ApiError(res.status, 'HTTP_ERROR', `Request failed (${res.status})`);
  }
  return schema.parse(json);
}
