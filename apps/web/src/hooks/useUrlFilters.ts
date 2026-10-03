import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export type Filters = Record<string, string[]>;

/**
 * Filter state kept in the URL query string (shareable links).
 * Each key holds a list of values stored comma-separated: `?status=OPEN,DRAFT`.
 * `q` is a plain string handled via `setSearch`.
 */
export function useUrlFilters(keys: readonly string[]) {
  const [params, setParams] = useSearchParams();

  const filters = useMemo(() => {
    const out: Filters = {};
    for (const key of keys) {
      const raw = params.get(key);
      out[key] = raw ? raw.split(',').filter(Boolean) : [];
    }
    return out;
  }, [params, keys]);

  const search = params.get('q') ?? '';

  const update = useCallback(
    (mutate: (next: URLSearchParams) => void) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          mutate(next);
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );

  const setFilter = useCallback(
    (key: string, values: string[]) =>
      update((next) => (values.length ? next.set(key, values.join(',')) : next.delete(key))),
    [update],
  );

  const setSearch = useCallback(
    (q: string) => update((next) => (q ? next.set('q', q) : next.delete('q'))),
    [update],
  );

  const clearAll = useCallback(
    () =>
      update((next) => {
        for (const key of [...keys, 'q']) next.delete(key);
      }),
    [update, keys],
  );

  return { filters, search, setFilter, setSearch, clearAll };
}
