import type { Provider } from '@mrdash/shared';

export interface OAuthIdentity {
  externalId: string;
  username: string;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
}

export interface AuthorizeParams {
  state: string;
  codeChallenge: string;
  redirectUri: string;
  /** Request the extra scope needed to read org/group membership. */
  withMembership: boolean;
}

/** One sign-in provider. The access token is used inside a single callback and then dropped. */
export interface OAuthProvider {
  id: Provider;
  name: string;
  authorizeUrl(params: AuthorizeParams): string;
  exchangeCode(params: {
    code: string;
    codeVerifier: string;
    redirectUri: string;
  }): Promise<string>;
  fetchIdentity(accessToken: string): Promise<OAuthIdentity>;
  /** True when the user belongs to the configured org/group. */
  isMember(accessToken: string, identity: OAuthIdentity): Promise<boolean>;
}

/** The provider rejected the exchange or returned something unusable. */
export class OAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OAuthError';
  }
}

export type FetchFn = typeof fetch;

/** `fetch` + JSON parse; non-2xx responses (except those in `allow`) throw an `OAuthError`. */
export async function requestJson(
  fetchFn: FetchFn,
  url: string,
  init: RequestInit,
  allow: number[] = [],
): Promise<{ status: number; body: unknown }> {
  const res = await fetchFn(url, init);
  if (!res.ok && !allow.includes(res.status)) {
    throw new OAuthError(`${new URL(url).host} responded ${res.status}`);
  }
  const text = await res.text();
  try {
    return { status: res.status, body: text ? (JSON.parse(text) as unknown) : null };
  } catch {
    throw new OAuthError(`${new URL(url).host} returned invalid JSON`);
  }
}

export const bearer = (token: string): Record<string, string> => ({
  authorization: `Bearer ${token}`,
  accept: 'application/json',
});
