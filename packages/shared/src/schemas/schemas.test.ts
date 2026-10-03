import { describe, expect, it } from 'vitest';
import {
  createTaskSchema,
  errorResponseSchema,
  mergeRequestFiltersSchema,
  paginationQuerySchema,
  providerParamSchema,
  taskFiltersSchema,
  updateTaskSchema,
  updateUserSchema,
} from './index.js';

describe('pagination', () => {
  it('defaults limit to 50', () => expect(paginationQuerySchema.parse({}).limit).toBe(50));
  it('coerces and caps limit at 200', () => {
    expect(paginationQuerySchema.parse({ limit: '100' }).limit).toBe(100);
    expect(paginationQuerySchema.safeParse({ limit: '201' }).success).toBe(false);
    expect(paginationQuerySchema.safeParse({ limit: '0' }).success).toBe(false);
  });
});

describe('filters', () => {
  it('parses csv and repeated multi-values', () => {
    expect(taskFiltersSchema.parse({ status: 'OPEN,DRAFT' }).status).toEqual(['OPEN', 'DRAFT']);
    expect(taskFiltersSchema.parse({ status: ['OPEN', 'NO_MR'] }).status).toEqual([
      'OPEN',
      'NO_MR',
    ]);
    expect(taskFiltersSchema.parse({ status: '' }).status).toBeUndefined();
  });
  it('rejects invalid enum values', () => {
    expect(taskFiltersSchema.safeParse({ status: 'BOGUS' }).success).toBe(false);
    expect(mergeRequestFiltersSchema.safeParse({ status: 'NO_MR' }).success).toBe(false);
  });
  it('treats a blank q as absent but still caps length', () => {
    expect(taskFiltersSchema.parse({ q: '' }).q).toBeUndefined();
    expect(mergeRequestFiltersSchema.parse({ q: '   ' }).q).toBeUndefined();
    expect(taskFiltersSchema.parse({ q: ' abc ' }).q).toBe('abc');
    expect(taskFiltersSchema.safeParse({ q: 'x'.repeat(201) }).success).toBe(false);
  });
  it('applies MR sort defaults', () => {
    const f = mergeRequestFiltersSchema.parse({});
    expect(f.sort).toBe('updatedAt');
    expect(f.order).toBe('desc');
  });
});

describe('task payloads', () => {
  it('create requires a non-blank title and defaults type', () => {
    expect(createTaskSchema.safeParse({ title: '  ' }).success).toBe(false);
    expect(createTaskSchema.parse({ title: ' Fix ' })).toMatchObject({
      title: 'Fix',
      type: 'TASK',
    });
  });
  it('update requires at least one field', () => {
    expect(updateTaskSchema.safeParse({}).success).toBe(false);
    expect(updateTaskSchema.parse({ notes: null })).toEqual({ notes: null });
  });
});

describe('error response', () => {
  it('accepts the documented shape', () => {
    expect(errorResponseSchema.safeParse({ error: { code: 'X', message: 'm' } }).success).toBe(
      true,
    );
    expect(errorResponseSchema.safeParse({ message: 'm' }).success).toBe(false);
  });
});

describe('user management schemas', () => {
  it('requires at least one field and validates the role', () => {
    expect(updateUserSchema.safeParse({}).success).toBe(false);
    expect(updateUserSchema.safeParse({ role: 'OWNER' }).success).toBe(false);
    expect(updateUserSchema.parse({ disabled: true })).toEqual({ disabled: true });
  });

  it('maps the :provider URL segment to the enum', () => {
    expect(providerParamSchema.parse({ provider: 'github' }).provider).toBe('GITHUB');
    expect(providerParamSchema.safeParse({ provider: 'bitbucket' }).success).toBe(false);
  });
});
