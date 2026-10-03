import { z } from 'zod';

// Keep in sync with the Prisma enums in apps/server/prisma/schema.prisma.
// `as const` objects give runtime values; the Zod enums validate input.

export const PROVIDERS = ['GITLAB', 'GITHUB'] as const;
export const USER_ROLES = ['ADMIN', 'MEMBER'] as const;
export const MR_STATUSES = ['DRAFT', 'OPEN', 'IN_REVIEW', 'MERGED', 'CLOSED'] as const;
export const TASK_TYPES = ['FEATURE', 'TASK', 'BUG'] as const;
export const TASK_STATUSES = [...MR_STATUSES, 'NO_MR'] as const;
export const SYNC_STATUSES = ['RUNNING', 'SUCCESS', 'FAILED'] as const;
export const REVIEWER_STATES = ['REQUESTED', 'APPROVED', 'CHANGES_REQUESTED'] as const;

export const providerSchema = z.enum(PROVIDERS);
export const userRoleSchema = z.enum(USER_ROLES);
export const mrStatusSchema = z.enum(MR_STATUSES);
export const taskTypeSchema = z.enum(TASK_TYPES);
export const taskStatusSchema = z.enum(TASK_STATUSES);
export const syncStatusSchema = z.enum(SYNC_STATUSES);
export const reviewerStateSchema = z.enum(REVIEWER_STATES);

export type Provider = z.infer<typeof providerSchema>;
export type UserRole = z.infer<typeof userRoleSchema>;
export type MrStatus = z.infer<typeof mrStatusSchema>;
export type TaskType = z.infer<typeof taskTypeSchema>;
export type TaskStatus = z.infer<typeof taskStatusSchema>;
export type SyncStatus = z.infer<typeof syncStatusSchema>;
export type ReviewerState = z.infer<typeof reviewerStateSchema>;
