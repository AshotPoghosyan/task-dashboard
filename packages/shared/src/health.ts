import { z } from 'zod';

export const healthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  db: z.enum(['up', 'down']),
  uptime: z.number(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
