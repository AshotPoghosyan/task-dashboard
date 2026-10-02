import { createHmac, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'mrdash_session';
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

const sign = (secret: string, payload: string): string =>
  createHmac('sha256', secret).update(payload).digest('base64url');

/** Cookie value `<expiresAtMs>.<hmac>`; stateless, so no session store is needed. */
export function createSessionToken(secret: string, now: number = Date.now()): string {
  const expires = String(now + SESSION_TTL_SECONDS * 1000);
  return `${expires}.${sign(secret, expires)}`;
}

export function verifySessionToken(
  secret: string,
  token: string,
  now: number = Date.now(),
): boolean {
  const [expires, signature, ...rest] = token.split('.');
  if (!expires || !signature || rest.length > 0) return false;
  const expected = Buffer.from(sign(secret, expires));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return false;
  return Number(expires) > now;
}

/** Constant-time string comparison (hashes first so lengths never leak). */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHmac('sha256', 'cmp').update(a).digest();
  const hb = createHmac('sha256', 'cmp').update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0 && part.slice(0, idx).trim() === name) return part.slice(idx + 1).trim();
  }
  return undefined;
}
