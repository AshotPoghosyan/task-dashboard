import {
  authProvidersSchema,
  authSessionSchema,
  authUserSchema,
  loginSchema,
  providerParamSchema,
} from '@mrdash/shared';
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  loginRequired,
  oauthEnabled,
  passwordEnabled,
  resolveAuthMode,
} from '../config/authConfig.js';
import type { Env } from '../config/env.js';
import { hasValidSession } from '../plugins/auth.js';
import {
  createSessionToken,
  readCookie,
  safeEqual,
  serializeCookie,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  SID_COOKIE,
  signValue,
  unsignValue,
} from '../plugins/session.js';
import type { OAuthRegistry } from '../providers/oauth/index.js';
import {
  beginLogin,
  completeLogin,
  LoginError,
  OAUTH_STATE_COOKIE,
  OAUTH_STATE_TTL_SECONDS,
} from '../services/oauthService.js';
import {
  createSession,
  destroySession,
  SESSION_MAX_AGE_SECONDS,
  toAuthUser,
} from '../services/sessionService.js';
import { signInTestUser } from '../services/testLoginService.js';
import { AppError } from '../utils/errors.js';

const callbackQuerySchema = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
});
const testLoginSchema = z.object({
  username: z.string().min(1).max(100),
  role: z.enum(['ADMIN', 'MEMBER']).default('MEMBER'),
});

interface Options {
  env: Env;
  oauth: OAuthRegistry;
}

export const authRoutes: FastifyPluginAsync<Options> = async (app, { env, oauth }) => {
  const secure = env.NODE_ENV === 'production';
  const webOrigin = new URL(env.WEB_ORIGIN).origin;
  const pwCookieBase = `Path=/; HttpOnly; SameSite=Strict${env.NODE_ENV === 'development' ? '' : '; Secure'}`;
  const sidCookie = (value: string, maxAge: number) =>
    serializeCookie(SID_COOKIE, value, { maxAge, sameSite: 'Lax', secure });
  const stateCookie = (value: string, maxAge: number) =>
    serializeCookie(OAUTH_STATE_COOKIE, value, {
      maxAge,
      sameSite: 'Lax',
      secure,
      path: '/api/auth',
    });

  /** Starts a session for `userId`, replacing any session the browser already had. */
  async function startSession(request: FastifyRequest, userId: string): Promise<string> {
    const old = readCookie(request.headers.cookie, SID_COOKIE);
    const oldToken = old && unsignValue(env.SESSION_SECRET, old);
    if (oldToken) await destroySession(oldToken);
    const token = await createSession(userId, {
      userAgent: request.headers['user-agent'],
      ip: request.ip,
    });
    return signValue(env.SESSION_SECRET, token);
  }

  app.get('/api/auth/providers', async () =>
    authProvidersSchema.parse({
      mode: resolveAuthMode(env),
      password: passwordEnabled(env),
      providers: Object.values(oauth).map((p) => ({ id: p.id, name: p.name })),
    }),
  );

  const limit = { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } };

  app.get('/api/auth/login/:provider', limit, async (request, reply) => {
    const { provider: id } = providerParamSchema.parse(request.params);
    const provider = oauthEnabled(env) ? oauth[id] : undefined;
    if (!provider) throw AppError.notFound('Sign-in provider');
    const redirectUri = `${webOrigin}/api/auth/callback/${id.toLowerCase()}`;
    const { url, cookie } = beginLogin(env, provider, redirectUri);
    void reply.header('set-cookie', stateCookie(cookie, OAUTH_STATE_TTL_SECONDS));
    return reply.redirect(url);
  });

  const fail = (reply: FastifyReply, reason: string) => {
    const page = reason === 'denied' || reason === 'disabled' ? '/access-denied' : '/login';
    const query = page === '/login' ? `?error=${reason}` : '';
    void reply.header('set-cookie', stateCookie('', 0));
    return reply.redirect(`${webOrigin}${page}${query}`);
  };

  app.get('/api/auth/callback/:provider', limit, async (request, reply) => {
    const { provider: id } = providerParamSchema.parse(request.params);
    const provider = oauthEnabled(env) ? oauth[id] : undefined;
    if (!provider) throw AppError.notFound('Sign-in provider');
    const query = callbackQuerySchema.parse(request.query);
    try {
      const user = await completeLogin(env, {
        provider,
        redirectUri: `${webOrigin}/api/auth/callback/${id.toLowerCase()}`,
        code: query.code,
        state: query.state,
        providerError: query.error,
        stateCookie: readCookie(request.headers.cookie, OAUTH_STATE_COOKIE),
      });
      const signed = await startSession(request, user.id);
      void reply.header('set-cookie', [
        sidCookie(signed, SESSION_MAX_AGE_SECONDS),
        stateCookie('', 0),
      ]);
      return reply.redirect(`${webOrigin}/`);
    } catch (err) {
      if (err instanceof LoginError) {
        request.log.info({ provider: id, reason: err.reason }, 'sign-in refused');
        return fail(reply, err.reason);
      }
      throw err;
    }
  });

  app.post(
    '/api/auth/login',
    // Tight limit to slow down password guessing.
    { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const { password } = loginSchema.parse(request.body);
      if (!loginRequired(env)) {
        return authSessionSchema.parse({ required: false, authenticated: true });
      }
      if (!passwordEnabled(env)) {
        throw new AppError(400, 'PASSWORD_LOGIN_DISABLED', 'Sign in with GitHub or GitLab');
      }
      if (!safeEqual(password, env.DASHBOARD_PASSWORD)) {
        throw new AppError(401, 'INVALID_CREDENTIALS', 'Incorrect password');
      }
      const token = createSessionToken(env.SESSION_SECRET);
      void reply.header(
        'set-cookie',
        `${SESSION_COOKIE}=${token}; ${pwCookieBase}; Max-Age=${SESSION_TTL_SECONDS}`,
      );
      return authSessionSchema.parse({ required: true, authenticated: true });
    },
  );

  app.post('/api/auth/logout', async (request, reply) => {
    const signed = readCookie(request.headers.cookie, SID_COOKIE);
    const token = signed && unsignValue(env.SESSION_SECRET, signed);
    if (token) await destroySession(token);
    void reply.header('set-cookie', [
      `${SESSION_COOKIE}=; ${pwCookieBase}; Max-Age=0`,
      sidCookie('', 0),
    ]);
    return reply.code(204).send();
  });

  app.get('/api/auth/session', async (request) => {
    const required = loginRequired(env);
    const viaPassword = passwordEnabled(env) && hasValidSession(env, request.headers.cookie);
    return authSessionSchema.parse({
      required,
      authenticated: !required || !!request.authUser || viaPassword,
      ...(request.authUser && { user: request.authUser }),
    });
  });

  app.get('/api/auth/me', async (request) => {
    if (!request.authUser) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
    return authUserSchema.parse(request.authUser);
  });

  // Test-only. The env schema refuses to boot with the helper on in production; this is a second lock.
  if (env.AUTH_TEST_HELPER && env.NODE_ENV !== 'production') {
    app.post('/api/auth/test-login', async (request, reply) => {
      const { username, role } = testLoginSchema.parse(request.body);
      const user = await signInTestUser(username, role);
      if (user.disabledAt) throw new AppError(403, 'USER_DISABLED', 'This account is disabled');
      const signed = await startSession(request, user.id);
      void reply.header('set-cookie', sidCookie(signed, SESSION_MAX_AGE_SECONDS));
      return authUserSchema.parse(toAuthUser(user));
    });
  }
};
