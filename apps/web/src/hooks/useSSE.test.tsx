import { renderHook } from '@testing-library/react';
import { backoffDelay, useSSE } from './useSSE';

class FakeSource {
  static instances: FakeSource[] = [];
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;
  listeners = new Map<string, (e: MessageEvent<string>) => void>();
  constructor(readonly url: string) {
    FakeSource.instances.push(this);
  }
  addEventListener(name: string, fn: (e: MessageEvent<string>) => void) {
    this.listeners.set(name, fn);
  }
  close() {
    this.closed = true;
  }
  emit(name: string, data: string) {
    this.listeners.get(name)?.({ data } as MessageEvent<string>);
  }
}
const createSource = (url: string) => new FakeSource(url) as unknown as EventSource;

beforeEach(() => {
  FakeSource.instances = [];
  vi.useFakeTimers();
  vi.spyOn(Math, 'random').mockReturnValue(0);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('backoffDelay', () => {
  it('doubles up to a 30s cap', () => {
    expect([0, 1, 2, 3].map((a) => backoffDelay(a))).toEqual([1000, 2000, 4000, 8000]);
    expect(backoffDelay(10)).toBe(30_000);
  });
});

describe('useSSE', () => {
  it('delivers parsed events and ignores malformed ones', () => {
    const onEvent = vi.fn();
    renderHook(() => useSSE(onEvent, { createSource }));
    const [source] = FakeSource.instances;
    source!.emit('mr.updated', '{"id":"a","repositoryId":"r"}');
    source!.emit('mr.updated', 'not json');
    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith('mr.updated', { id: 'a', repositoryId: 'r' });
  });

  it('reconnects with growing backoff and resets after a successful open', () => {
    renderHook(() => useSSE(vi.fn(), { createSource }));
    FakeSource.instances[0]!.onerror?.();
    expect(FakeSource.instances[0]!.closed).toBe(true);
    vi.advanceTimersByTime(999);
    expect(FakeSource.instances).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(FakeSource.instances).toHaveLength(2);

    FakeSource.instances[1]!.onerror?.();
    vi.advanceTimersByTime(1999);
    expect(FakeSource.instances).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(FakeSource.instances).toHaveLength(3);

    FakeSource.instances[2]!.onopen?.();
    FakeSource.instances[2]!.onerror?.();
    vi.advanceTimersByTime(1000);
    expect(FakeSource.instances).toHaveLength(4);
  });

  it('calls onReconnect only when the stream reopens after a drop', () => {
    const onReconnect = vi.fn();
    renderHook(() => useSSE(vi.fn(), { createSource, onReconnect }));
    FakeSource.instances[0]!.onopen?.();
    expect(onReconnect).not.toHaveBeenCalled();
    FakeSource.instances[0]!.onerror?.();
    vi.advanceTimersByTime(1000);
    FakeSource.instances[1]!.onopen?.();
    expect(onReconnect).toHaveBeenCalledTimes(1);
  });

  it('closes and stops reconnecting on unmount', () => {
    const { unmount } = renderHook(() => useSSE(vi.fn(), { createSource }));
    FakeSource.instances[0]!.onerror?.();
    unmount();
    vi.advanceTimersByTime(60_000);
    expect(FakeSource.instances).toHaveLength(1);
  });
});
