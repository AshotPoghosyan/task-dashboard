import fp from 'fastify-plugin';
import type { Env } from '../config/env.js';
import { AppError } from '../utils/errors.js';
import { readCookie, SESSION_COOKIE, verifySessionToken } from './session.js';

/** Paths reachable without a session: health, login, and signature-verified webhooks. */
const PUBLIC_PATHS = ['/api/health', '/api/gitlab-webhook'];
const PUBLIC_PREFIXES = ['/api/auth/', '/api/webhooks/'];

export const isAuthEnabled = (env: Env): boolean => env.DASHBOARD_PASSWORD !== '';

export function hasValidSession(env: Env, cookieHeader: string | undefined): boolean {
  const token = readCookie(cookieHeader, SESSION_COOKIE);
  return !!token && verifySessionToken(env.SESSION_SECRET, token);
}

/** Requires a valid session cookie on every `/api` route when `DASHBOARD_PASSWORD` is set. */
export const authPlugin = fp<{ env: Env }>(async (app, { env }) => {
  if (!isAuthEnabled(env)) return;
  app.addHook('onRequest', async (request) => {
    const path = request.url.split('?')[0] ?? '';
    if (!path.startsWith('/api/')) return;
    if (PUBLIC_PATHS.includes(path) || PUBLIC_PREFIXES.some((p) => path.startsWith(p))) return;
    if (!hasValidSession(env, request.headers.cookie)) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
    }
  });
});
