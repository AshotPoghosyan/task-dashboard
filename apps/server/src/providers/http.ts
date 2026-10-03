export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export interface HttpOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  fetchFn?: typeof fetch;
  /** Injectable so tests never wait in real time. */
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

export interface HttpResult<T> {
  data: T;
  headers: Headers;
}

const defaultSleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function isRateLimited(res: Response): boolean {
  return res.headers.has('retry-after') || res.headers.get('x-ratelimit-remaining') === '0';
}

/** Retry on 429, 5xx, and 403 only when the response says it is a rate limit. */
function isRetryable(res: Response): boolean {
  if (res.status === 429 || res.status >= 500) return true;
  return res.status === 403 && isRateLimited(res);
}

/** Honours `Retry-After` / `X-RateLimit-Reset`, else exponential backoff; always capped. */
export function retryDelayMs(res: Response | null, attempt: number, o: HttpOptions): number {
  const base = o.baseDelayMs ?? 500;
  const max = o.maxDelayMs ?? 60_000;
  const retryAfter = Number(res?.headers.get('retry-after'));
  if (res && Number.isFinite(retryAfter) && res.headers.has('retry-after')) {
    return Math.min(retryAfter * 1000, max);
  }
  const reset = Number(res?.headers.get('x-ratelimit-reset'));
  if (res && res.headers.get('x-ratelimit-remaining') === '0' && Number.isFinite(reset)) {
    const wait = reset * 1000 - (o.now ?? Date.now)();
    if (wait > 0) return Math.min(wait, max);
  }
  return Math.min(base * 2 ** attempt, max);
}

/** GET a JSON resource with a timeout and up to `maxRetries` (default 3) retries. */
export async function getJson<T>(url: string, o: HttpOptions = {}): Promise<HttpResult<T>> {
  const fetchFn = o.fetchFn ?? fetch;
  const sleep = o.sleep ?? defaultSleep;
  const maxRetries = o.maxRetries ?? 3;

  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetchFn(url, {
        headers: { accept: 'application/json', ...o.headers },
        signal: AbortSignal.timeout(o.timeoutMs ?? 15_000),
      });
    } catch (err) {
      // Network errors and timeouts are retried like 5xx responses.
      if (attempt >= maxRetries) throw err;
      await sleep(retryDelayMs(null, attempt, o));
      continue;
    }
    if (res.ok) return { data: (await res.json()) as T, headers: res.headers };
    if (!isRetryable(res) || attempt >= maxRetries) {
      throw new HttpError(res.status, url, `GET ${url} failed with ${res.status}`);
    }
    await sleep(retryDelayMs(res, attempt, o));
  }
}
