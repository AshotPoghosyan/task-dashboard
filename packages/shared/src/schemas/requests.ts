import { z } from 'zod';
import {
  mrStatusSchema,
  providerSchema,
  taskStatusSchema,
  taskTypeSchema,
  userRoleSchema,
} from '../enums.js';
import { multiValue, paginationQuerySchema } from './common.js';

const title = z.string().trim().min(1).max(500);
const optionalText = (max: number) => z.string().trim().max(max).nullable();

export const createTaskSchema = z.object({
  title,
  type: taskTypeSchema.default('TASK'),
  assigneeName: optionalText(200).optional(),
  targetBranch: optionalText(200).optional(),
  notes: optionalText(10_000).optional(),
  parentId: z.string().min(1).nullable().optional(),
  statusOverride: taskStatusSchema.nullable().optional(),
});
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = z
  .object({
    title,
    type: taskTypeSchema,
    assigneeName: optionalText(200),
    targetBranch: optionalText(200),
    notes: optionalText(10_000),
    parentId: z.string().min(1).nullable(),
    statusOverride: taskStatusSchema.nullable(),
    sortOrder: z.number().int(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export const linkMergeRequestSchema = z.object({ mergeRequestId: z.string().min(1) });
export type LinkMergeRequestInput = z.infer<typeof linkMergeRequestSchema>;

// A blank `?q=` (cleared search box) means "no search", not a validation error.
const q = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z.string().trim().max(200).optional(),
);

/** `?mine=1` / `?mine=true` switches a "mine" filter on; anything else is off. */
const flag = z.preprocess((v) => v === '1' || v === 'true' || v === true, z.boolean());

export const TASK_SORT_FIELDS = ['updatedAt', 'createdAt', 'sortOrder'] as const;

export const taskFiltersSchema = paginationQuerySchema.extend({
  /** Only mine: needs `me`. */
  mine: flag,
  /** Git user id of the person using the dashboard. */
  me: z.string().min(1).optional(),
  sort: z.enum(TASK_SORT_FIELDS).default('updatedAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
  status: multiValue(taskStatusSchema),
  assignee: multiValue(z.string()),
  targetBranch: multiValue(z.string()),
  type: multiValue(taskTypeSchema),
  q,
});
export type TaskFilters = z.infer<typeof taskFiltersSchema>;

export const MR_SORT_FIELDS = ['updatedAt', 'createdAt', 'title'] as const;

export const MR_VIEWS = ['attention'] as const;

export const mergeRequestFiltersSchema = paginationQuerySchema.extend({
  /** `attention` lists what needs action, most urgent first, with a `reasons` array per item. */
  view: z.enum(MR_VIEWS).optional(),
  mine: flag,
  /** Git user id of the person using the dashboard (drives "mine" and review-related reasons). */
  me: z.string().min(1).optional(),
  provider: multiValue(providerSchema),
  repositoryId: multiValue(z.string()),
  status: multiValue(mrStatusSchema),
  authorId: multiValue(z.string()),
  assigneeId: multiValue(z.string()),
  reviewerId: multiValue(z.string()),
  targetBranch: multiValue(z.string()),
  q,
  sort: z.enum(MR_SORT_FIELDS).default('updatedAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});
export type MergeRequestFilters = z.infer<typeof mergeRequestFiltersSchema>;

export const loginSchema = z.object({ password: z.string().min(1).max(500) });
export type LoginInput = z.infer<typeof loginSchema>;

/** `:provider` URL segment: `github` or `gitlab`, normalised to the enum value. */
export const providerParamSchema = z.object({
  provider: z.enum(['github', 'gitlab']).transform((v) => v.toUpperCase() as 'GITHUB' | 'GITLAB'),
});

export const updateUserSchema = z
  .object({ role: userRoleSchema, disabled: z.boolean() })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
