import type { GitUser } from '@mrdash/shared';
import { useMemo, useSyncExternalStore } from 'react';
import { useSession } from '../../api/auth';
import { useFilterOptions } from '../../api/tasks';

export const ME_KEY = 'mrdash.me';
const listeners = new Set<() => void>();

const readStored = (): string | null => {
  try {
    return localStorage.getItem(ME_KEY);
  } catch {
    return null;
  }
};

function writeStored(id: string | null): void {
  try {
    if (id) localStorage.setItem(ME_KEY, id);
    else localStorage.removeItem(ME_KEY);
  } catch {
    // Storage can be blocked; the choice then lasts until the next reload only.
  }
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

/** The git user that matches a signed-in account (same provider, same username, any case). */
export function matchGitUser(
  users: readonly GitUser[],
  account: { provider: string; username: string },
): GitUser | null {
  const name = account.username.toLowerCase();
  return (
    users.find((u) => u.provider === account.provider && u.username.toLowerCase() === name) ?? null
  );
}

export interface MeState {
  me: GitUser | null;
  users: readonly GitUser[];
  /** True once the git user list has loaded, so "unknown" really means unknown. */
  ready: boolean;
  /** True when the identity comes from the personal login and cannot be changed here. */
  fromLogin: boolean;
  setMeId: (id: string | null) => void;
}

/**
 * Who is using the dashboard, as a git user: the signed-in account when there is one,
 * otherwise the person picked in "Who are you?" (remembered in localStorage).
 */
export function useMe(): MeState {
  const { data: session } = useSession();
  const { data: options } = useFilterOptions();
  const storedId = useSyncExternalStore(subscribe, readStored, () => null);
  const users = useMemo(() => options?.users ?? [], [options]);

  return useMemo(() => {
    const fromAccount = session?.user ? matchGitUser(users, session.user) : null;
    const picked = users.find((u) => u.id === storedId) ?? null;
    return {
      me: fromAccount ?? picked,
      users,
      ready: !!options,
      fromLogin: !!fromAccount,
      setMeId: writeStored,
    };
  }, [session, users, storedId, options]);
}
