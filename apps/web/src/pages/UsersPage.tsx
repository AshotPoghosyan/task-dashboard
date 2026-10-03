import type { User, UserRole } from '@mrdash/shared';
import { useState } from 'react';
import { useSession } from '../api/auth';
import { ApiError } from '../api/client';
import { useUpdateUser, useUsers } from '../api/users';
import { Avatar } from '../components/data/Avatar';
import { ProviderIcon } from '../components/data/ProviderIcon';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Dialog, DialogContent } from '../components/ui/Dialog';
import { EmptyState } from '../components/ui/EmptyState';
import { Select } from '../components/ui/Select';
import { Skeleton } from '../components/ui/Skeleton';
import { useToast } from '../components/ui/Toast';
import { formatDateTime } from '../lib/datetime';

const ROLE_OPTIONS = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'MEMBER', label: 'Member' },
];

type Change = { user: User; role: UserRole } | { user: User; disabled: boolean };

const copyFor = (c: Change): { title: string; body: string; action: string } => {
  const name = c.user.displayName;
  if ('role' in c) {
    return {
      title: `Make ${name} ${c.role === 'ADMIN' ? 'an admin' : 'a member'}?`,
      body:
        c.role === 'ADMIN'
          ? 'Admins can see all users, change roles and disable accounts.'
          : 'They will lose access to user management.',
      action: 'Change role',
    };
  }
  return c.disabled
    ? {
        title: `Disable ${name}?`,
        body: 'They are signed out everywhere right away and cannot sign in again until re-enabled.',
        action: 'Disable',
      }
    : {
        title: `Enable ${name}?`,
        body: 'They can sign in again if they are still on the allowlist.',
        action: 'Enable',
      };
};

/** Admin-only table of everyone who has signed in, with role and enable/disable controls. */
export default function UsersPage() {
  const session = useSession();
  const isAdmin = session.data?.user?.role === 'ADMIN';
  const users = useUsers(isAdmin);
  const update = useUpdateUser();
  const toast = useToast();
  const [change, setChange] = useState<Change | null>(null);

  if (session.isPending) return <Skeleton className="h-8 w-48" />;
  if (!isAdmin) {
    return (
      <EmptyState
        title="Admins only"
        description="Ask a dashboard admin if you need to manage who can sign in."
      />
    );
  }

  const confirm = () => {
    if (!change) return;
    const body = 'role' in change ? { role: change.role } : { disabled: change.disabled };
    update.mutate(
      { id: change.user.id, ...body },
      {
        onSuccess: () => toast({ title: 'User updated', tone: 'success' }),
        onError: (err) =>
          toast({
            title: 'Could not update user',
            description: err instanceof ApiError ? err.message : 'Try again.',
            tone: 'error',
          }),
        onSettled: () => setChange(null),
      },
    );
  };

  const text = change ? copyFor(change) : null;

  return (
    <>
      <h1 className="mb-4 text-xl font-semibold">Users</h1>
      {users.isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : users.isError ? (
        <EmptyState
          title="Could not load users"
          action={<Button onClick={() => void users.refetch()}>Retry</Button>}
        />
      ) : (
        <div className="overflow-x-auto rounded-card border border-border">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Users who can sign in</caption>
            <thead className="border-b border-border bg-surface text-xs text-fg-secondary">
              <tr>
                <th scope="col" className="p-2 font-medium">
                  User
                </th>
                <th scope="col" className="p-2 font-medium">
                  Provider
                </th>
                <th scope="col" className="p-2 font-medium">
                  Role
                </th>
                <th scope="col" className="p-2 font-medium">
                  Last login
                </th>
                <th scope="col" className="p-2 font-medium">
                  Status
                </th>
                <th scope="col" className="p-2 font-medium">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {users.data.items.map((u) => (
                <tr key={u.id} className="border-b border-border last:border-0">
                  <td className="p-2">
                    <span className="flex items-center gap-2">
                      <Avatar name={u.displayName} avatarUrl={u.avatarUrl} />
                      <span>
                        <span className="block font-medium">{u.displayName}</span>
                        <span className="block text-xs text-fg-secondary">
                          @{u.username}
                          {u.email ? ` · ${u.email}` : ''}
                        </span>
                      </span>
                    </span>
                  </td>
                  <td className="p-2">
                    <span className="flex items-center gap-1.5">
                      <ProviderIcon provider={u.provider} />
                      {u.provider === 'GITHUB' ? 'GitHub' : 'GitLab'}
                    </span>
                  </td>
                  <td className="p-2">
                    <Select
                      aria-label={`Role for ${u.displayName}`}
                      value={u.role}
                      options={ROLE_OPTIONS}
                      onValueChange={(role) =>
                        role !== u.role && setChange({ user: u, role: role as UserRole })
                      }
                    />
                  </td>
                  <td className="tabular p-2">
                    {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : 'Never'}
                  </td>
                  <td className="p-2">
                    <Badge className={u.disabledAt ? 'text-danger' : 'text-success'}>
                      {u.disabledAt ? 'Disabled' : 'Active'}
                    </Badge>
                  </td>
                  <td className="p-2">
                    <Button
                      size="sm"
                      variant={u.disabledAt ? 'secondary' : 'danger'}
                      aria-label={`${u.disabledAt ? 'Enable' : 'Disable'} ${u.displayName}`}
                      onClick={() => setChange({ user: u, disabled: !u.disabledAt })}
                    >
                      {u.disabledAt ? 'Enable' : 'Disable'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={change !== null} onOpenChange={(open) => !open && setChange(null)}>
        {text ? (
          <DialogContent title={text.title} description={text.body}>
            <div className="flex justify-end gap-2">
              <Button onClick={() => setChange(null)}>Cancel</Button>
              <Button variant="primary" onClick={confirm} disabled={update.isPending}>
                {text.action}
              </Button>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </>
  );
}
