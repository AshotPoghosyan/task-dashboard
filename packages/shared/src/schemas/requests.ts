import { z } from 'zod';
import { mrStatusSchema, providerSchema, taskStatusSchema, taskTypeSchema } from '../enums.js';
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

const q = z.string().trim().min(1).max(200).optional();

export const taskFiltersSchema = paginationQuerySchema.extend({
  status: multiValue(taskStatusSchema),
  assignee: multiValue(z.string()),
  targetBranch: multiValue(z.string()),
  type: multiValue(taskTypeSchema),
  q,
});
export type TaskFilters = z.infer<typeof taskFiltersSchema>;

export const MR_SORT_FIELDS = ['updatedAt', 'createdAt', 'title'] as const;

export const mergeRequestFiltersSchema = paginationQuerySchema.extend({
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
