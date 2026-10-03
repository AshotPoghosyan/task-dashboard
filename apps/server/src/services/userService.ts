import type { UpdateUserInput, User } from '@mrdash/shared';
import {
  findUserById,
  listUsers as selectUsers,
  lockActiveAdminIds,
  updateUser as patchUser,
  type UserRow,
} from '../repositories/userRepository.js';
import { inTransaction } from '../repositories/db.js';
import { AppError } from '../utils/errors.js';
import { destroyUserSessions } from './sessionService.js';

export function toUser(u: UserRow): User {
  return {
    id: u.id,
    provider: u.provider,
    username: u.username,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl,
    role: u.role,
    email: u.email,
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    disabledAt: u.disabledAt?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
  };
}

export async function listUsers(): Promise<User[]> {
  return (await selectUsers()).map(toUser);
}

/** Changes role and/or disabled state. Refuses to remove the last active admin. */
export async function updateUser(
  id: string,
  input: UpdateUserInput,
  now = new Date(),
): Promise<User> {
  const updated = await inTransaction(async (db) => {
    const adminIds = await lockActiveAdminIds(db);
    const user = await findUserById(id, db);
    if (!user) throw AppError.notFound('User');

    const loses =
      (input.role === 'MEMBER' && user.role === 'ADMIN') ||
      (input.disabled === true && user.role === 'ADMIN');
    if (loses && adminIds.length === 1 && adminIds[0] === id) {
      throw AppError.unprocessable(
        'LAST_ADMIN',
        'This is the last active admin. Promote someone else first.',
      );
    }
    return patchUser(
      id,
      {
        ...(input.role && { role: input.role }),
        ...(input.disabled !== undefined && { disabledAt: input.disabled ? now : null }),
      },
      db,
    );
  });
  // Disabling takes effect on the very next request: the sessions are gone.
  if (input.disabled) await destroyUserSessions(id);
  return toUser(updated);
}
