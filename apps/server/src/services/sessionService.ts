import { createHash, randomBytes } from 'node:crypto';
import type { AuthUser } from '@mrdash/shared';
import type { User } from '@prisma/client';
import {
  deleteExpiredSessions,
  deleteSessionByHash,
  deleteSessionsForUser,
  findSessionByHash,
  insertSession,
  renewSession,
} from '../repositories/sessionRepository.js';

export const SESSION_DAYS = 14;
export const SESSION_MAX_AGE_SECONDS = SESSION_DAYS * 86_400;
/** Sliding renewal is written at most this often, so reads do not become writes. */
const RENEW_AFTER_MS = 60_000;

const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');
const expiryFrom = (now: Date): Date => new Date(now.getTime() + SESSION_MAX_AGE_SECONDS * 1000);

export const toAuthUser = (u: User): AuthUser => ({
  id: u.id,
  provider: u.provider,
  username: u.username,
  displayName: u.displayName,
  avatarUrl: u.avatarUrl,
  role: u.role,
});

/** Starts a session and returns the random token for the cookie (only its hash is stored). */
export async function createSession(
  userId: string,
  meta: { userAgent?: string | undefined; ip?: string | undefined },
  now: Date = new Date(),
): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await insertSession({
    userId,
    tokenHash: hashToken(token),
    expiresAt: expiryFrom(now),
    userAgent: meta.userAgent?.slice(0, 300) ?? null,
    ip: meta.ip ?? null,
    now,
  });
  return token;
}

export interface ResolvedSession {
  user: User;
  /** True when the expiry was pushed out, so the cookie's Max-Age should be refreshed too. */
  renewed: boolean;
}

/** The user behind a token, or null when it is unknown, expired, or the user is disabled. */
export async function resolveSession(
  token: string,
  now: Date = new Date(),
): Promise<ResolvedSession | null> {
  const tokenHash = hashToken(token);
  const session = await findSessionByHash(tokenHash);
  if (!session) return null;
  if (session.expiresAt <= now) {
    await deleteSessionByHash(tokenHash);
    return null;
  }
  if (session.user.disabledAt) return null;
  const stale = now.getTime() - session.lastSeenAt.getTime() > RENEW_AFTER_MS;
  if (stale) await renewSession(session.id, expiryFrom(now), now);
  return { user: session.user, renewed: stale };
}

export const destroySession = (token: string): Promise<void> =>
  deleteSessionByHash(hashToken(token));

export const destroyUserSessions = deleteSessionsForUser;

/** Daily job: drops sessions past their expiry. */
export const purgeExpiredSessions = (now: Date = new Date()): Promise<number> =>
  deleteExpiredSessions(now);
