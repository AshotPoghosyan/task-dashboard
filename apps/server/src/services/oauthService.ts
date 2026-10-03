import { createHash, randomBytes } from 'node:crypto';
import type { Provider } from '@mrdash/shared';
import type { Env } from '../config/env.js';
import type { OAuthIdentity, OAuthProvider } from '../providers/oauth/index.js';
import { signValue, unsignValue } from '../plugins/session.js';
import { upsertUserOnLogin, type UserRow } from '../repositories/userRepository.js';
import { isListedAdmin, isListedUser } from './accessPolicy.js';

export const OAUTH_STATE_COOKIE = 'mrdash_oauth';
export const OAUTH_STATE_TTL_SECONDS = 600;

/** Why a sign-in did not complete; the route turns this into a friendly page. */
export type LoginFailure = 'state' | 'provider' | 'denied' | 'disabled';

export class LoginError extends Error {
  constructor(readonly reason: LoginFailure) {
    super(`login failed: ${reason}`);
    this.name = 'LoginError';
  }
}

interface StatePayload {
  s: string;
  v: string;
  p: Provider;
  e: number;
}

const b64 = (buf: Buffer): string => buf.toString('base64url');

/** The provider URL to send the browser to, and the signed cookie that remembers state + PKCE. */
export function beginLogin(
  env: Env,
  provider: OAuthProvider,
  redirectUri: string,
  now: number = Date.now(),
): { url: string; cookie: string } {
  const state = b64(randomBytes(24));
  const verifier = b64(randomBytes(48));
  const payload: StatePayload = {
    s: state,
    v: verifier,
    p: provider.id,
    e: now + OAUTH_STATE_TTL_SECONDS * 1000,
  };
  const withMembership =
    (provider.id === 'GITHUB' && env.AUTH_ALLOWED_GITHUB_ORG.trim() !== '') ||
    (provider.id === 'GITLAB' && env.AUTH_ALLOWED_GITLAB_GROUP.trim() !== '');
  return {
    url: provider.authorizeUrl({
      state,
      codeChallenge: b64(createHash('sha256').update(verifier).digest()),
      redirectUri,
      withMembership,
    }),
    cookie: signValue(env.SESSION_SECRET, b64(Buffer.from(JSON.stringify(payload)))),
  };
}

function readState(env: Env, cookie: string | undefined, now: number): StatePayload | null {
  const raw = cookie && unsignValue(env.SESSION_SECRET, cookie);
  if (!raw) return null;
  try {
    const p = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as StatePayload;
    return p.e > now ? p : null;
  } catch {
    return null;
  }
}

export interface CallbackInput {
  provider: OAuthProvider;
  redirectUri: string;
  code: string | undefined;
  state: string | undefined;
  /** `error` query param: the user cancelled or the provider refused. */
  providerError: string | undefined;
  stateCookie: string | undefined;
}

/**
 * Finishes the authorization-code flow: checks state, exchanges the code, reads the identity,
 * applies the allowlist, and stores the user. The access token lives only inside this call.
 */
export async function completeLogin(
  env: Env,
  input: CallbackInput,
  now: Date = new Date(),
): Promise<UserRow> {
  const saved = readState(env, input.stateCookie, now.getTime());
  if (!saved || saved.p !== input.provider.id || !input.state || saved.s !== input.state) {
    throw new LoginError('state');
  }
  if (input.providerError || !input.code) throw new LoginError('provider');

  let identity: OAuthIdentity;
  let allowed: boolean;
  try {
    const token = await input.provider.exchangeCode({
      code: input.code,
      codeVerifier: saved.v,
      redirectUri: input.redirectUri,
    });
    identity = await input.provider.fetchIdentity(token);
    allowed =
      isListedUser(env, input.provider.id, identity) ||
      (await input.provider.isMember(token, identity));
  } catch {
    // Network failure, rejected code, or an unexpected payload: all look the same to the user.
    throw new LoginError('provider');
  }
  if (!allowed) throw new LoginError('denied');

  const role = isListedAdmin(env, input.provider.id, identity) ? 'ADMIN' : 'MEMBER';
  const user = await upsertUserOnLogin(input.provider.id, identity, role, now);
  if (user.disabledAt) throw new LoginError('disabled');
  return user;
}
