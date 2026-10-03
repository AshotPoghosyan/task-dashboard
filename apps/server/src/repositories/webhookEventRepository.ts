import { Prisma, type Provider, type WebhookEvent } from '@prisma/client';
import { getPrisma } from '../db/prisma.js';
import type { Db } from './db.js';

export interface NewWebhookEvent {
  provider: Provider;
  deliveryId: string;
  eventType: string;
  payload: Prisma.InputJsonValue;
}

/** Inserts the event; returns `null` when (provider, deliveryId) was already stored. */
export async function insertWebhookEvent(e: NewWebhookEvent): Promise<{ id: string } | null> {
  try {
    return await getPrisma().webhookEvent.create({ data: e, select: { id: true } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return null;
    throw err;
  }
}

/** Removes a stored event, e.g. when it could not be queued so a redelivery is not seen as a duplicate. */
export async function deleteWebhookEvent(id: string): Promise<void> {
  await getPrisma().webhookEvent.deleteMany({ where: { id } });
}

export function findWebhookEvent(id: string): Promise<WebhookEvent | null> {
  return getPrisma().webhookEvent.findUnique({ where: { id } });
}

/** `error` records why an event was ignored or failed; `null` clears an earlier failure. */
export async function markWebhookProcessed(
  id: string,
  error: string | null,
  db: Db = getPrisma(),
): Promise<void> {
  await db.webhookEvent.update({ where: { id }, data: { processedAt: new Date(), error } });
}

export async function markWebhookFailed(id: string, error: string): Promise<void> {
  await getPrisma().webhookEvent.update({ where: { id }, data: { error } });
}

export async function deleteWebhookEventsBefore(cutoff: Date): Promise<number> {
  const { count } = await getPrisma().webhookEvent.deleteMany({
    where: { receivedAt: { lt: cutoff } },
  });
  return count;
}
