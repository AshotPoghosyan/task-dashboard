import type { Provider } from '@mrdash/shared';
import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import type { WebhookHeaders } from '../providers/types.js';
import type { WebhookHandlers } from '../providers/webhooks.js';
import { deleteWebhookEvent, insertWebhookEvent } from '../repositories/webhookEventRepository.js';
import { AppError } from '../utils/errors.js';

/** Hands a stored event to the job queue (pg-boss in production). */
export interface WebhookQueue {
  enqueue(eventId: string): Promise<void>;
}

export type IngestResult = 'accepted' | 'duplicate' | 'ignored';

/**
 * Request-path half of webhook handling: verify, drop irrelevant events, store (idempotent) and
 * enqueue. Does no MR work itself so the HTTP response stays well under a second.
 */
export async function ingestWebhook(
  provider: Provider,
  headers: WebhookHeaders,
  rawBody: Buffer,
  deps: { handlers: WebhookHandlers; queue: WebhookQueue },
): Promise<IngestResult> {
  const handler = deps.handlers[provider];
  if (!handler.verify(headers, rawBody)) {
    throw new AppError(401, 'INVALID_SIGNATURE', 'Webhook signature verification failed');
  }
  const eventType = handler.relevantEvent(headers);
  if (!eventType) return 'ignored';

  let payload: Prisma.InputJsonValue;
  try {
    payload = JSON.parse(rawBody.toString('utf8')) as Prisma.InputJsonValue; // verified sender
  } catch {
    throw AppError.badRequest('INVALID_JSON', 'Webhook body is not valid JSON');
  }

  // Providers always send a delivery id; hashing the body keeps hand-made requests idempotent.
  const deliveryId =
    handler.deliveryId(headers) ?? `sha256:${createHash('sha256').update(rawBody).digest('hex')}`;
  const stored = await insertWebhookEvent({ provider, deliveryId, eventType, payload });
  if (!stored) return 'duplicate';
  try {
    await deps.queue.enqueue(stored.id);
  } catch (err) {
    // Otherwise the provider's retry would hit the unique key and the event would be lost.
    await deleteWebhookEvent(stored.id);
    throw err;
  }
  return 'accepted';
}
