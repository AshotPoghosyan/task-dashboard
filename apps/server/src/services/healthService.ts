import type { HealthResponse } from '@mrdash/shared';
import { pingDatabase } from '../repositories/healthRepository.js';

export async function getHealth(): Promise<HealthResponse> {
  const dbUp = await pingDatabase();
  return {
    status: dbUp ? 'ok' : 'degraded',
    db: dbUp ? 'up' : 'down',
    uptimeSeconds: Math.round(process.uptime()),
  };
}
