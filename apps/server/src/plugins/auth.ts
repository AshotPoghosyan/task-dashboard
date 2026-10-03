import type { AuthUser } from '@mrdash/shared';
import type { FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { loginRequired, oauthEnabled, passwordEnabled } from '../config/authConfig.js';
import type { Env } from '../config/env.js';
import { resolveSession, SESSION_MAX_AGE_SECONDS, toAuthUser } from '../services/sessionService.js';
import { AppError } from '../utils/errors.js';
import {
  readCookie,
  serializeCookie,
  SESSION_COOKIE,
  SID_COOKIE,
  unsignValue,
  verifySessionToken,
} from './session.js';

declare module 'fastify' {
  interface FastifyRequest {
    /** The signed-in OAuth user, if the request carried a valid session. */
    authUser: AuthUser | null;
  }
}

/** Paths reachable without a session: health, login, and signature-verified webhooks. */
const PUBLIC_PATHS = ['/api/health', '/api/gitlab-webhook'];
const PUBLIC_PREFIXES = ['/api/auth/', '/api/webhooks/'];
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const isWebhook = (path: string): boolean =>
  path === '/api/gitlab-webhook' || path.startsWith('/api/webhooks/');

/** Is the shared-password cookie present and valid? */
export function hasValidSession(env: Env, cookieHeader: string | undefined): boolean {
  const token = readCookie(cookieHeader, SESSION_COOKIE);
  return !!token && verifySessionToken(env.SESSION_SECRET, token);
}

/** Origin of `WEB_ORIGIN`, the only site allowed to make state-changing requests. */
function requestSource(request: FastifyRequest): string | undefined {
  const { origin, referer } = request.headers;
  if (origin) return origin;
  if (!referer) return undefined;
  try {
    return new URL(referer).origin;
  } catch {
    return 'invalid';
  }
}

/**
 * CSRF defence for cookie auth: a mutation must come from `WEB_ORIGIN` (Origin, else Referer).
 * A request with neither header and no cookies is a non-browser client and cannot be forged
 * cross-site, so it is let through; with cookies attached it must prove its origin.
 */
function assertSameOrigin(env: Env, request: FastifyRequest): void {
  const source = requestSource(request);
  if (source === undefined && !request.headers.cookie) return;
  if (source !== new URL(env.WEB_ORIGIN).origin) {
    throw new AppError(403, 'CSRF_ORIGIN', 'Cross-site request blocked');
  }
}

/** Throws 403 unless the request comes from a signed-in admin. */
export function requireAdmin(request: FastifyRequest): AuthUser {
  if (request.authUser?.role !== 'ADMIN') {
    throw new AppError(403, 'FORBIDDEN', 'Admin access required');
  }
  return request.authUser;
}

/**
 * Identifies the caller (OAuth session or shared-password cookie), enforces the origin check on
 * mutations, and requires a login on every `/api` route when sign-in is enabled.
 */
export const authPlugin = fp<{ env: Env }>(async (app, { env }) => {
  app.decorateRequest('authUser', null);
  const secure = env.NODE_ENV === 'production';

  app.addHook('onRequest', async (request, reply) => {
    const path = request.url.split('?')[0] ?? '';
    if (!path.startsWith('/api/')) return;
    if (MUTATING.has(request.method) && !isWebhook(path)) assertSameOrigin(env, request);

    if (oauthEnabled(env)) {
      const signed = readCookie(request.headers.cookie, SID_COOKIE);
      const token = signed ? unsignValue(env.SESSION_SECRET, signed) : undefined;
      const resolved = token ? await resolveSession(token) : null;
      if (resolved && signed) {
        request.authUser = toAuthUser(resolved.user);
        if (resolved.renewed) {
          void reply.header(
            'set-cookie',
            serializeCookie(SID_COOKIE, signed, {
              maxAge: SESSION_MAX_AGE_SECONDS,
              sameSite: 'Lax',
              secure,
            }),
          );
        }
      }
    }

    if (!loginRequired(env)) return;
    if (PUBLIC_PATHS.includes(path) || PUBLIC_PREFIXES.some((p) => path.startsWith(p))) return;
    if (request.authUser) return;
    if (passwordEnabled(env) && hasValidSession(env, request.headers.cookie)) return;
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  });
});
