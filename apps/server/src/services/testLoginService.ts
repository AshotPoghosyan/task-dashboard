import type { UserRole } from '@mrdash/shared';
import { upsertUserOnLogin, type UserRow } from '../repositories/userRepository.js';

/** Creates (or re-uses) a fake GitHub user for tests; only reachable via `AUTH_TEST_HELPER`. */
export const signInTestUser = (username: string, role: UserRole): Promise<UserRow> =>
  upsertUserOnLogin(
    'GITHUB',
    {
      externalId: `test:${username}`,
      username,
      email: null,
      displayName: username,
      avatarUrl: null,
    },
    role,
    new Date(),
  );
