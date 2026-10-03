import { LogOut, Menu, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLogout } from '../../api/auth';
import { useDebounce } from '../../hooks/useDebounce';
import { useHotkeys } from '../../hooks/useHotkeys';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { Button } from '../ui/Button';
import { Drawer, DrawerContent, DrawerTrigger, DialogClose } from '../ui/Dialog';
import { Input } from '../ui/Input';
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

export function TopBar({ showLogout }: { showLogout: boolean }) {
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
                <NavList />
              </span>
            </DialogClose>
          </nav>
        </DrawerContent>
      </Drawer>
      <GlobalSearch />
      <div className="ml-auto flex items-center gap-3">
        <SyncIndicator />
        {showLogout ? (
          <Button variant="ghost" size="sm" onClick={() => logout.mutate()}>
            <LogOut size={14} aria-hidden="true" /> Sign out
          </Button>
        ) : null}
      </div>
    </header>
  );
}
