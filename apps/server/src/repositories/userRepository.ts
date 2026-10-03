import type { Prisma, Provider, User, UserRole } from '@prisma/client';
import { getPrisma } from '../db/prisma.js';
import type { Db } from './db.js';

export type UserRow = User;

export interface LoginProfile {
  externalId: string;
  username: string;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
}

/** Creates the user on first login (with `roleOnCreate`) or refreshes the profile. Never changes role. */
export function upsertUserOnLogin(
  provider: Provider,
  profile: LoginProfile,
  roleOnCreate: UserRole,
  now: Date,
): Promise<UserRow> {
  const { externalId, ...fields } = profile;
  return getPrisma().user.upsert({
    where: { provider_externalId: { provider, externalId } },
    create: { provider, externalId, ...fields, role: roleOnCreate, lastLoginAt: now },
    update: { ...fields, lastLoginAt: now },
  });
}

export const findUserById = (id: string, db: Db = getPrisma()): Promise<UserRow | null> =>
  db.user.findUnique({ where: { id } });

export const listUsers = (): Promise<UserRow[]> =>
  getPrisma().user.findMany({ orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });

export const updateUser = (
  id: string,
  data: Prisma.UserUpdateInput,
  db: Db = getPrisma(),
): Promise<UserRow> => db.user.update({ where: { id }, data });

/**
 * Row-locks every active admin until the transaction ends and returns their ids, so concurrent
 * demotions cannot each see "someone else is still admin".
 */
export async function lockActiveAdminIds(db: Db): Promise<string[]> {
  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT id FROM users WHERE role = 'ADMIN' AND "disabledAt" IS NULL ORDER BY id FOR UPDATE`;
  return rows.map((r) => r.id);
}
