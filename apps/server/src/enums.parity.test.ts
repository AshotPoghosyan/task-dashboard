import { Prisma } from '@prisma/client';
import {
  MR_STATUSES,
  PROVIDERS,
  REVIEWER_STATES,
  SYNC_STATUSES,
  TASK_STATUSES,
  TASK_TYPES,
  USER_ROLES,
} from '@mrdash/shared';
import { describe, expect, it } from 'vitest';

const prismaValues = (name: string) =>
  Prisma.dmmf.datamodel.enums.find((e) => e.name === name)?.values.map((v) => v.name);

describe('shared enums match the Prisma enums', () => {
  it.each([
    ['Provider', PROVIDERS],
    ['MrStatus', MR_STATUSES],
    ['TaskType', TASK_TYPES],
    ['TaskStatus', TASK_STATUSES],
    ['SyncStatus', SYNC_STATUSES],
    ['ReviewerState', REVIEWER_STATES],
    ['UserRole', USER_ROLES],
  ])('%s', (name, shared) => {
    expect(prismaValues(name)).toEqual([...shared]);
  });
});
