import { authSessionSchema, loginSchema } from '@mrdash/shared';
import type { FastifyPluginAsync } from 'fastify';
import type { Env } from '../config/env.js';
import { hasValidSession, isAuthEnabled } from '../plugins/auth.js';
import {
  createSessionToken,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  safeEqual,
} from '../plugins/session.js';
import { AppError } from '../utils/errors.js';

export const authRoutes: FastifyPluginAsync<{ env: Env }> = async (app, { env }) => {
  const cookieBase = `Path=/; HttpOnly; SameSite=Strict${env.NODE_ENV === 'development' ? '' : '; Secure'}`;

  app.post(
    '/api/auth/login',
    // Tight limit to slow down password guessing.
    { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const { password } = loginSchema.parse(request.body);
      if (!isAuthEnabled(env))
        return authSessionSchema.parse({ required: false, authenticated: true });
      if (!safeEqual(password, env.DASHBOARD_PASSWORD)) {
        throw new AppError(401, 'INVALID_CREDENTIALS', 'Incorrect password');
      }
      const token = createSessionToken(env.SESSION_SECRET);
      void reply.header(
        'set-cookie',
        `${SESSION_COOKIE}=${token}; ${cookieBase}; Max-Age=${SESSION_TTL_SECONDS}`,
      );
      return authSessionSchema.parse({ required: true, authenticated: true });
    },
  );

  app.post('/api/auth/logout', async (_request, reply) => {
    void reply.header('set-cookie', `${SESSION_COOKIE}=; ${cookieBase}; Max-Age=0`);
    return reply.code(204).send();
  });

  app.get('/api/auth/session', async (request) =>
    authSessionSchema.parse({
      required: isAuthEnabled(env),
      authenticated: !isAuthEnabled(env) || hasValidSession(env, request.headers.cookie),
    }),
  );
};
