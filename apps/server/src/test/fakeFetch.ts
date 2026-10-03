import { readFileSync } from 'node:fs';

export interface FakeResponse {
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
}

export interface FakeFetch {
  fetchFn: typeof fetch;
  urls: string[];
}

/** Loads a recorded JSON fixture that sits next to the calling test. */
export function fixture<T>(testUrl: string, name: string): T {
  return JSON.parse(readFileSync(new URL(`./__fixtures__/${name}`, testUrl), 'utf8')) as T;
}

/** A fetch stand-in: `handler` maps each request URL to a canned response. No network. */
export function fakeFetch(handler: (url: URL, call: number) => FakeResponse): FakeFetch {
  const urls: string[] = [];
  const fetchFn = (async (input: string | URL | Request) => {
    const url = new URL(
      typeof input === 'string' ? input : input instanceof URL ? input : input.url,
    );
    urls.push(url.toString());
    const r = handler(url, urls.length);
    return new Response(JSON.stringify(r.body ?? []), {
      status: r.status ?? 200,
      headers: { 'content-type': 'application/json', ...r.headers },
    });
  }) as typeof fetch;
  return { fetchFn, urls };
}

export const noSleep = (): Promise<void> => Promise.resolve();
