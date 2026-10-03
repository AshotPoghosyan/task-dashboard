import type PgBoss from 'pg-boss';
import type { FastifyBaseLogger } from 'fastify';
import { deleteWebhookEventsBefore } from '../repositories/webhookEventRepository.js';
import type { WebhookQueue } from '../services/webhookIngestService.js';
import { processWebhookEvent, type WebhookProcessDeps } from '../services/webhookProcessor.js';

export const WEBHOOK_QUEUE = 'process-webhook';
export const RETENTION_QUEUE = 'purge-webhook-events';
export const WEBHOOK_RETENTION_DAYS = 30;

/** Deletes webhook events older than the retention window; returns how many were removed. */
export function purgeOldWebhookEvents(now: Date = new Date()): Promise<number> {
  return deleteWebhookEventsBefore(new Date(now.getTime() - WEBHOOK_RETENTION_DAYS * 86_400_000));
}

export function createPgBossWebhookQueue(boss: PgBoss): WebhookQueue {
  return {
    async enqueue(eventId) {
      await boss.send(WEBHOOK_QUEUE, { eventId }, { retryLimit: 3, retryBackoff: true });
    },
  };
}

/** Without a job queue (tests, scripts) events are processed in the background of this process. */
export function createInlineWebhookQueue(deps: WebhookProcessDeps): WebhookQueue {
  return {
    async enqueue(eventId) {
      void processWebhookEvent(eventId, deps).catch((err: unknown) =>
        deps.logger.error({ err, eventId }, 'webhook processing failed'),
      );
    },
  };
}

/** Registers the webhook worker and the daily retention schedule on a started pg-boss. */
export async function registerWebhookJobs(
  boss: PgBoss,
  deps: WebhookProcessDeps,
  logger: FastifyBaseLogger,
): Promise<void> {
  await boss.createQueue(WEBHOOK_QUEUE, { name: WEBHOOK_QUEUE });
  await boss.createQueue(RETENTION_QUEUE, { name: RETENTION_QUEUE });

  await boss.work<{ eventId: string }>(WEBHOOK_QUEUE, async (jobs) => {
    for (const job of jobs) await processWebhookEvent(job.data.eventId, deps);
  });
  await boss.work(RETENTION_QUEUE, async () => {
    const removed = await purgeOldWebhookEvents();
    logger.info({ removed }, 'purged old webhook events');
  });
  await boss.schedule(RETENTION_QUEUE, '17 3 * * *');
}
