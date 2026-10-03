import type { Prisma, PrismaClient } from '@prisma/client';
import { getPrisma } from '../db/prisma.js';

/** Either the shared client or an interactive-transaction client. */
export type Db = PrismaClient | Prisma.TransactionClient;

/** Runs `fn` in one transaction; repositories called with the given `db` join it. */
export function inTransaction<T>(fn: (db: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return getPrisma().$transaction(fn);
}
