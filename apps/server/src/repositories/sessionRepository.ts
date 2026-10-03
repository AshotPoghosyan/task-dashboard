import type { Session, User } from '@prisma/client';
import { getPrisma } from '../db/prisma.js';

export type SessionWithUser = Session & { user: User };

export interface NewSession {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  userAgent: string | null;
  ip: string | null;
  now: Date;
}

export const insertSession = (s: NewSession): Promise<Session> =>
  getPrisma().session.create({
    data: {
      userId: s.userId,
      tokenHash: s.tokenHash,
      expiresAt: s.expiresAt,
      lastSeenAt: s.now,
      userAgent: s.userAgent,
      ip: s.ip,
    },
  });

export const findSessionByHash = (tokenHash: string): Promise<SessionWithUser | null> =>
  getPrisma().session.findUnique({ where: { tokenHash }, include: { user: true } });

export const renewSession = (id: string, expiresAt: Date, lastSeenAt: Date): Promise<Session> =>
  getPrisma().session.update({ where: { id }, data: { expiresAt, lastSeenAt } });

export const deleteSessionByHash = async (tokenHash: string): Promise<void> => {
  await getPrisma().session.deleteMany({ where: { tokenHash } });
};

export const deleteSessionsForUser = async (userId: string): Promise<number> =>
  (await getPrisma().session.deleteMany({ where: { userId } })).count;

export const deleteExpiredSessions = async (now: Date): Promise<number> =>
  (await getPrisma().session.deleteMany({ where: { expiresAt: { lte: now } } })).count;
