import { SSE_EVENT_NAMES, type SseEventName } from '@mrdash/shared';
import { useEffect, useRef } from 'react';

const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30_000;

/** Exponential backoff: 1s, 2s, 4s … capped at 30s. `jitter` is a 0–1 random fraction. */
export const backoffDelay = (attempt: number, jitter = 0): number =>
  Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** attempt) * (1 - jitter * 0.25);

interface Options {
  url?: string;
  /** Injected in tests. */
  createSource?: (url: string) => EventSource;
}

/**
 * Subscribes to the server's SSE stream. Reconnects with exponential backoff after an error
 * (the browser's own retry is disabled by closing the source) and resets once reconnected.
 */
export function useSSE(
  onEvent: (name: SseEventName, data: unknown) => void,
  { url = '/api/events', createSource }: Options = {},
): void {
  const handler = useRef(onEvent);
  handler.current = onEvent;

  useEffect(() => {
    const make =
      createSource ??
      (typeof EventSource === 'undefined'
        ? null
        : (u: string) => new EventSource(u, { withCredentials: true }));
    if (!make) return;

    let source: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    let stopped = false;

    const connect = () => {
      const es = make(url);
      source = es;
      es.onopen = () => {
        attempt = 0;
      };
      for (const name of SSE_EVENT_NAMES) {
        es.addEventListener(name, (e) => {
          try {
            handler.current(name, JSON.parse((e as MessageEvent<string>).data));
          } catch {
            // Malformed payload: ignore this event, keep the stream.
          }
        });
      }
      es.onerror = () => {
        es.close();
        if (stopped) return;
        timer = setTimeout(connect, backoffDelay(attempt++, Math.random()));
      };
    };
    connect();

    return () => {
      stopped = true;
      clearTimeout(timer);
      source?.close();
    };
  }, [url, createSource]);
}
