import { describe, expect, it, vi } from 'vitest';
import { fakeFetch } from '../test/fakeFetch.js';
import { getJson, HttpError } from './http.js';

const URL_ = 'https://api.example/x';

describe('getJson', () => {
  it('returns data and headers on success', async () => {
    const f = fakeFetch(() => ({ body: { ok: 1 }, headers: { 'x-next-page': '2' } }));
    const res = await getJson<{ ok: number }>(URL_, { fetchFn: f.fetchFn });
    expect(res.data).toEqual({ ok: 1 });
    expect(res.headers.get('x-next-page')).toBe('2');
  });

  it('backs off on 429 honouring Retry-After, then succeeds', async () => {
    const sleep = vi.fn<(ms: number) => Promise<void>>(() => Promise.resolve());
    const f = fakeFetch((_u, call) =>
      call < 3 ? { status: 429, headers: { 'retry-after': '2' } } : { body: ['done'] },
    );
    const res = await getJson<string[]>(URL_, { fetchFn: f.fetchFn, sleep });
    expect(res.data).toEqual(['done']);
    expect(f.urls).toHaveLength(3);
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([2000, 2000]);
  });

  it('uses exponential backoff on 5xx and gives up after 3 retries', async () => {
    const sleep = vi.fn<(ms: number) => Promise<void>>(() => Promise.resolve());
    const f = fakeFetch(() => ({ status: 503 }));
    await expect(
      getJson(URL_, { fetchFn: f.fetchFn, sleep, baseDelayMs: 100 }),
    ).rejects.toMatchObject({ status: 503 });
    expect(f.urls).toHaveLength(4); // 1 try + 3 retries
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([100, 200, 400]);
  });

  it('waits until X-RateLimit-Reset on a rate-limited 403', async () => {
    const sleep = vi.fn<(ms: number) => Promise<void>>(() => Promise.resolve());
    const f = fakeFetch((_u, call) =>
      call === 1
        ? { status: 403, headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1030' } }
        : { body: [] },
    );
    await getJson(URL_, { fetchFn: f.fetchFn, sleep, now: () => 1_000_000 });
    expect(sleep).toHaveBeenCalledWith(30_000);
  });

  it('does not retry a plain 403 or 404', async () => {
    for (const status of [403, 404]) {
      const f = fakeFetch(() => ({ status }));
      await expect(getJson(URL_, { fetchFn: f.fetchFn, sleep: vi.fn() })).rejects.toBeInstanceOf(
        HttpError,
      );
      expect(f.urls).toHaveLength(1);
    }
  });

  it('retries network errors', async () => {
    let calls = 0;
    const fetchFn = (() => {
      calls++;
      return calls === 1
        ? Promise.reject(new TypeError('fetch failed'))
        : Promise.resolve(new Response('[1]'));
    }) as typeof fetch;
    const res = await getJson<number[]>(URL_, { fetchFn, sleep: () => Promise.resolve() });
    expect(res.data).toEqual([1]);
    expect(calls).toBe(2);
  });

  it('caps the wait at maxDelayMs', async () => {
    const sleep = vi.fn<(ms: number) => Promise<void>>(() => Promise.resolve());
    const f = fakeFetch((_u, call) =>
      call === 1 ? { status: 429, headers: { 'retry-after': '3600' } } : { body: [] },
    );
    await getJson(URL_, { fetchFn: f.fetchFn, sleep, maxDelayMs: 5000 });
    expect(sleep).toHaveBeenCalledWith(5000);
  });
});
