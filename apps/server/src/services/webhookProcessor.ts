import type { FastifyBaseLogger } from 'fastify';
import { eventBus, type EventBus } from '../events/bus.js';
import type { NormalizedReviewer } from '../providers/types.js';
import type { WebhookHandlers } from '../providers/webhooks.js';
import { inTransaction } from '../repositories/db.js';
import {
  findMergeRequestByNumber,
  upsertMergeRequestBatch,
} from '../repositories/mergeRequestSyncRepository.js';
import { findRepositoryByExternalId } from '../repositories/repositoryRepository.js';
import {
  findWebhookEvent,
  markWebhookFailed,
  markWebhookProcessed,
} from '../repositories/webhookEventRepository.js';
import { applyLinkHints } from './mrLinkingService.js';
import { invalidateStatsCache } from './statsService.js';
import { recalculateTaskStatus, recalculateTasksForMergeRequest } from './taskStatusService.js';

export interface WebhookProcessDeps {
  handlers: WebhookHandlers;
  logger: Pick<FastifyBaseLogger, 'info' | 'warn' | 'error'>;
  bus?: EventBus;
}

export type WebhookOutcome = 'processed' | 'ignored' | 'skipped';

/**
 * Worker body: turns a stored webhook event into an MR upsert, task recalculation and bus events.
 * Throws on unexpected failures (the queue retries); expected non-actionable events are recorded
 * on the row and resolve normally.
 */
export async function processWebhookEvent(
  eventId: string,
  deps: WebhookProcessDeps,
): Promise<WebhookOutcome> {
  const { logger } = deps;
  const bus = deps.bus ?? eventBus;
  const event = await findWebhookEvent(eventId);
  if (!event || event.processedAt) return 'skipped';

  try {
    const handler = deps.handlers[event.provider];
    const parsed = handler.parse(event.payload);
    if (!parsed) {
      await markWebhookProcessed(event.id, 'ignored: unsupported payload');
      return 'ignored';
    }
    const repo = await findRepositoryByExternalId(event.provider, parsed.repositoryExternalId);
    if (!repo?.isActive) {
      logger.warn(
        { provider: event.provider, repository: parsed.repositoryExternalId },
        'webhook for unknown repository ignored',
      );
      await markWebhookProcessed(event.id, 'ignored: unknown repository');
      return 'ignored';
    }

    const result = await inTransaction(async (db) => {
      const existing = await findMergeRequestByNumber(db, repo.id, parsed.mr.number);
      // Deliveries can arrive out of order; never replace newer data with older.
      if (existing && existing.updatedAtRemote > parsed.mr.updatedAtRemote) {
        await markWebhookProcessed(event.id, 'ignored: stale event', db);
        return null;
      }
      const known: NormalizedReviewer[] = (existing?.reviewers ?? []).map((r) => ({
        state: r.state,
        user: {
          externalId: r.gitUser.externalId,
          username: r.gitUser.username,
          displayName: r.gitUser.displayName,
          avatarUrl: r.gitUser.avatarUrl,
        },
      }));
      const mr = handler.mergeKnownReviewers?.(parsed.mr, known) ?? parsed.mr;

      const [mrId] = await upsertMergeRequestBatch(db, repo, [mr]);
      if (!mrId) throw new Error('merge request upsert returned no id');
      const linked = await applyLinkHints(db, repo, mrId, mr);
      const tasks = new Set(await recalculateTasksForMergeRequest(mrId, db));
      for (const id of linked) {
        if (!tasks.has(id)) await recalculateTaskStatus(id, db);
        tasks.add(id);
      }
      await markWebhookProcessed(event.id, null, db);
      return { mrId, taskIds: [...tasks] };
    });
    if (!result) return 'skipped';

    invalidateStatsCache();
    bus.emit('mr.updated', { id: result.mrId, repositoryId: repo.id });
    for (const id of result.taskIds) bus.emit('task.updated', { id });
    return 'processed';
  } catch (err) {
    await markWebhookFailed(event.id, err instanceof Error ? err.message : String(err));
    throw err;
  }
}
