import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { useDebounce } from './useDebounce';
import { useHotkeys } from './useHotkeys';
import { useUrlFilters } from './useUrlFilters';

const KEYS = ['status'] as const;
const wrapper = ({ children }: { children: ReactNode }) => (
  <MemoryRouter initialEntries={['/?status=OPEN,DRAFT&q=hi']}>{children}</MemoryRouter>
);

describe('useDebounce', () => {
  it('delays updates', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 250), {
      initialProps: { v: 'a' },
    });
    rerender({ v: 'b' });
    expect(result.current).toBe('a');
    act(() => void vi.advanceTimersByTime(250));
    expect(result.current).toBe('b');
    vi.useRealTimers();
  });
});

describe('useHotkeys', () => {
  it('fires on a key but not while typing in an input', () => {
    const handler = vi.fn();
    renderHook(() => useHotkeys({ '/': handler }));
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true }));
    expect(handler).toHaveBeenCalledTimes(1);
    const input = document.createElement('input');
    document.body.append(input);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true }));
    expect(handler).toHaveBeenCalledTimes(1);
    input.remove();
  });
});

describe('useUrlFilters', () => {
  it('reads, updates and clears filters in the URL', () => {
    const { result } = renderHook(() => useUrlFilters(KEYS), { wrapper });
    expect(result.current.filters.status).toEqual(['OPEN', 'DRAFT']);
    expect(result.current.search).toBe('hi');
    act(() => result.current.setFilter('status', ['MERGED']));
    expect(result.current.filters.status).toEqual(['MERGED']);
    act(() => result.current.clearAll());
    expect(result.current.filters.status).toEqual([]);
    expect(result.current.search).toBe('');
  });
});
