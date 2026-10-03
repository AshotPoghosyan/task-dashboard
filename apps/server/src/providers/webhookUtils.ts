import { createHash, timingSafeEqual } from 'node:crypto';
import type { WebhookHeaders } from './types.js';

export function headerValue(headers: WebhookHeaders, name: string): string | null {
  const v = headers[name.toLowerCase()];
  const first = Array.isArray(v) ? v[0] : v;
  return first ? first : null;
}

/** Constant-time string equality (hashing first makes the compared lengths equal). */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}
