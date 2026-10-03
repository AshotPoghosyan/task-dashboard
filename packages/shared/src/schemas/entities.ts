import { z } from 'zod';
import {
  mrStatusSchema,
  providerSchema,
  reviewerStateSchema,
  taskStatusSchema,
  taskTypeSchema,
} from '../enums.js';

const isoDate = z.string().datetime({ offset: true });

export const repositorySchema = z.object({
  id: z.string(),
  provider: providerSchema,
  externalId: z.string(),
  fullPath: z.string(),
  webUrl: z.string(),
  defaultBranch: z.string(),
  isActive: z.boolean(),
  lastSyncedAt: isoDate.nullable(),
});
export type Repository = z.infer<typeof repositorySchema>;

export const gitUserSchema = z.object({
  id: z.string(),
  provider: providerSchema,
  externalId: z.string(),
  username: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
});
export type GitUser = z.infer<typeof gitUserSchema>;

export const reviewerSchema = z.object({
  user: gitUserSchema,
  state: reviewerStateSchema,
});
export type Reviewer = z.infer<typeof reviewerSchema>;

/** Task reference shown on a merge request row (the "linked task" column). */
export const linkedTaskSchema = z.object({ id: z.string(), title: z.string() });
export type LinkedTask = z.infer<typeof linkedTaskSchema>;

export const mergeRequestSchema = z.object({
  id: z.string(),
  repositoryId: z.string(),
  provider: providerSchema,
  externalId: z.string(),
  number: z.number().int(),
  title: z.string(),
  description: z.string().nullable(),
  status: mrStatusSchema,
  isDraft: z.boolean(),
  sourceBranch: z.string(),
  targetBranch: z.string(),
  url: z.string(),
  author: gitUserSchema,
  assignee: gitUserSchema.nullable(),
  reviewers: z.array(reviewerSchema),
  createdAtRemote: isoDate,
  updatedAtRemote: isoDate,
  mergedAt: isoDate.nullable(),
  closedAt: isoDate.nullable(),
  tasks: z.array(linkedTaskSchema),
});
export type MergeRequest = z.infer<typeof mergeRequestSchema>;

/** Compact MR representation embedded in task responses. */
export const mergeRequestSummarySchema = mergeRequestSchema.pick({
  id: true,
  provider: true,
  number: true,
  title: true,
  status: true,
  url: true,
});
export type MergeRequestSummary = z.infer<typeof mergeRequestSummarySchema>;

const taskBaseShape = {
  id: z.string(),
  title: z.string(),
  type: taskTypeSchema,
  status: taskStatusSchema,
  statusOverride: taskStatusSchema.nullable(),
  assigneeName: z.string().nullable(),
  targetBranch: z.string().nullable(),
  notes: z.string().nullable(),
  parentId: z.string().nullable(),
  sortOrder: z.number().int(),
  createdAt: isoDate,
  updatedAt: isoDate,
  mergeRequests: z.array(mergeRequestSummarySchema),
};

/** A sub-bug: a task that cannot have children (max one level of nesting). */
export const subTaskSchema = z.object(taskBaseShape);
export type SubTask = z.infer<typeof subTaskSchema>;

export const taskSchema = z.object({
  ...taskBaseShape,
  children: z.array(subTaskSchema),
});
export type Task = z.infer<typeof taskSchema>;

export const statsSchema = z.object({
  openMrs: z.number().int().nonnegative(),
  pendingReviews: z.number().int().nonnegative(),
  mergedToday: z.number().int().nonnegative(),
  draft: z.number().int().nonnegative(),
  closedThisWeek: z.number().int().nonnegative(),
});
export type Stats = z.infer<typeof statsSchema>;

export const repositoryListSchema = z.object({ items: z.array(repositorySchema) });

export const filterOptionsSchema = z.object({
  /** Distinct `assigneeName` values on tasks. */
  assignees: z.array(z.string()),
  /** Distinct target branches across tasks and merge requests. */
  branches: z.array(z.string()),
  repositories: z.array(repositorySchema.pick({ id: true, provider: true, fullPath: true })),
  /** Git users (authors, assignees, reviewers) for merge request dropdowns. */
  users: z.array(gitUserSchema),
});
export type FilterOptions = z.infer<typeof filterOptionsSchema>;

export const authSessionSchema = z.object({
  /** True when `DASHBOARD_PASSWORD` is configured. */
  required: z.boolean(),
  authenticated: z.boolean(),
});
export type AuthSession = z.infer<typeof authSessionSchema>;
