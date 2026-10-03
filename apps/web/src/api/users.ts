import { userListSchema, userSchema, type UpdateUserInput } from '@mrdash/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';

const usersKey = ['users'] as const;

export const useUsers = (enabled: boolean) =>
  useQuery({
    queryKey: usersKey,
    queryFn: () => api('/users', { schema: userListSchema }),
    enabled,
  });

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: UpdateUserInput & { id: string }) =>
      api(`/users/${id}`, { method: 'PATCH', body, schema: userSchema }),
    onSuccess: () => qc.invalidateQueries({ queryKey: usersKey }),
  });
}
