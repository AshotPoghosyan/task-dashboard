import { getPrisma } from '../db/prisma.js';

/** Returns true when the database answers a trivial query. */
export async function pingDatabase(): Promise<boolean> {
  try {
    await getPrisma().$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
