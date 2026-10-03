import { z } from 'zod';

/** Payloads of the `/api/events` SSE stream (mirrors the server event bus). */
export const SSE_EVENT_NAMES = ['mr.updated', 'task.updated', 'sync.finished'] as const;
export type SseEventName = (typeof SSE_EVENT_NAMES)[number];

export const sseEventSchemas = {
  'mr.updated': z.object({ id: z.string(), repositoryId: z.string() }),
  'task.updated': z.object({ id: z.string() }),
  'sync.finished': z.object({
    repositoryId: z.string(),
    status: z.enum(['SUCCESS', 'FAILED']),
  }),
} as const satisfies Record<SseEventName, z.ZodType>;

export type SseEventPayloads = { [K in SseEventName]: z.infer<(typeof sseEventSchemas)[K]> };
