import { QueryCache, QueryClient, MutationCache } from '@tanstack/react-query';
import { ApiError } from './client';

export function createQueryClient(): QueryClient {
  const client: QueryClient = new QueryClient({
    // An expired session mid-use: refetch the session so the route guard redirects to /login.
    queryCache: new QueryCache({ onError: (err, query) => onUnauthorized(err, query.queryKey) }),
    mutationCache: new MutationCache({ onError: (err) => onUnauthorized(err) }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Retrying a 4xx (e.g. 401) cannot succeed.
        retry: (count, err) =>
          !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
        refetchOnWindowFocus: false,
      },
    },
  });
  function onUnauthorized(err: unknown, key?: readonly unknown[]) {
    if (err instanceof ApiError && err.status === 401 && key?.[0] !== 'session') {
      void client.invalidateQueries({ queryKey: ['session'] });
    }
  }
  return client;
}
