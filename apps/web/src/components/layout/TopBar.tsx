import type { AuthUser } from '@mrdash/shared';
import { ChevronDown, LogOut, Menu, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLogout } from '../../api/auth';
import { useDebounce } from '../../hooks/useDebounce';
import { useHotkeys } from '../../hooks/useHotkeys';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { Avatar } from '../data/Avatar';
import { Button } from '../ui/Button';
import { Drawer, DrawerContent, DrawerTrigger, DialogClose } from '../ui/Dialog';
import { Input } from '../ui/Input';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/Popover';
import { NavList } from './Sidebar';
import { SyncIndicator } from './SyncIndicator';

const NO_KEYS: readonly string[] = [];

/** Global search bound to the `q` URL param (debounced 250 ms); `/` focuses it. */
function GlobalSearch() {
  const { search, setSearch } = useUrlFilters(NO_KEYS);
  const [text, setText] = useState(search);
  const debounced = useDebounce(text, 250);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => setText(search), [search]);
  useEffect(() => {
    if (debounced !== search) setSearch(debounced);
    // Only push when the typed text settles, not when the URL changes.
  }, [debounced]);

  useHotkeys({
    '/': (e) => {
      e.preventDefault();
      ref.current?.focus();
    },
  });

  return (
    <div className="relative w-full max-w-md">
      <Search
        size={14}
        aria-hidden="true"
        className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-fg-muted"
      />
      <Input
        ref={ref}
        type="search"
        aria-label="Search"
        placeholder="Search…  (press / to focus)"
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="pl-7"
      />
    </div>
  );
}

/** Avatar + name; opens a small menu with the account details and "Sign out". */
function UserMenu({ user }: { user: AuthUser }) {
  const logout = useLogout();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={`Account menu for ${user.displayName}`}>
          <Avatar name={user.displayName} avatarUrl={user.avatarUrl} size={20} />
          <span className="hidden max-w-[10rem] truncate sm:inline">{user.displayName}</span>
          <ChevronDown size={12} aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="flex w-56 flex-col gap-2">
        <div>
          <p className="truncate font-medium">{user.displayName}</p>
          <p className="truncate text-xs text-fg-secondary">
            @{user.username} · {user.provider === 'GITHUB' ? 'GitHub' : 'GitLab'} ·{' '}
            {user.role === 'ADMIN' ? 'Admin' : 'Member'}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => logout.mutate()}>
          <LogOut size={14} aria-hidden="true" /> Sign out
        </Button>
      </PopoverContent>
    </Popover>
  );
}

interface TopBarProps {
  showLogout: boolean;
  user?: AuthUser | undefined;
}

export function TopBar({ showLogout, user }: TopBarProps) {
  const logout = useLogout();
  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-surface px-3">
      <Drawer>
        <DrawerTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
            <Menu size={16} aria-hidden="true" />
          </Button>
        </DrawerTrigger>
        <DrawerContent title="Navigation" side="left">
          <nav aria-label="Mobile">
            <DialogClose asChild>
              <span>
                <NavList isAdmin={user?.role === 'ADMIN'} />
              </span>
            </DialogClose>
          </nav>
        </DrawerContent>
      </Drawer>
      <GlobalSearch />
      <div className="ml-auto flex items-center gap-3">
        <SyncIndicator />
        {user ? (
          <UserMenu user={user} />
        ) : showLogout ? (
          <Button variant="ghost" size="sm" onClick={() => logout.mutate()}>
            <LogOut size={14} aria-hidden="true" /> Sign out
          </Button>
        ) : null}
      </div>
    </header>
  );
}
