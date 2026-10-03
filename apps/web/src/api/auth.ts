import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authProvidersSchema, authSessionSchema } from '@mrdash/shared';
import { z } from 'zod';
import { api } from './client';

const okSchema = z.unknown();

export const sessionKey = ['session'] as const;

export const useSession = () =>
  useQuery({
    queryKey: sessionKey,
    queryFn: () => api('/auth/session', { schema: authSessionSchema }),
  });

/** Which sign-in buttons / password form the login page shows. */
export const useAuthProviders = () =>
  useQuery({
    queryKey: ['auth-providers'],
    queryFn: () => api('/auth/providers', { schema: authProvidersSchema }),
    staleTime: 5 * 60_000,
  });

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (password: string) =>
      api('/auth/login', { method: 'POST', body: { password }, schema: okSchema }),
    onSuccess: () => qc.invalidateQueries({ queryKey: sessionKey }),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api('/auth/logout', { method: 'POST', schema: okSchema }),
    onSuccess: () => {
      // A full reload drops every cached query, so nothing of this user stays in memory.
      qc.clear();
      window.location.assign('/login');
    },
  });
}
