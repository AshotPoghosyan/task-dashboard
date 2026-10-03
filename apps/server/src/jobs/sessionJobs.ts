import type { FastifyBaseLogger } from 'fastify';
import type PgBoss from 'pg-boss';
import { purgeExpiredSessions } from '../services/sessionService.js';

export const SESSION_PURGE_QUEUE = 'purge-expired-sessions';

/** Registers the daily job that deletes expired sessions on a started pg-boss. */
export async function registerSessionJobs(boss: PgBoss, logger: FastifyBaseLogger): Promise<void> {
  await boss.createQueue(SESSION_PURGE_QUEUE, { name: SESSION_PURGE_QUEUE });
  await boss.work(SESSION_PURGE_QUEUE, async () => {
    const removed = await purgeExpiredSessions();
    logger.info({ removed }, 'purged expired sessions');
  });
  await boss.schedule(SESSION_PURGE_QUEUE, '41 3 * * *');
}
