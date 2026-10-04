import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/** One plain string kept in the URL query (`?tab=all`); an empty value removes the param. */
export function useUrlParam(key: string): [string | null, (value: string | null) => void] {
  const [params, setParams] = useSearchParams();
  const set = useCallback(
    (value: string | null) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value) next.set(key, value);
          else next.delete(key);
          return next;
        },
        { replace: true },
      ),
    [setParams, key],
  );
  return [params.get(key), set];
}
