import type { AuthUser } from '@mrdash/shared';
import { ChevronDown, LogOut, Monitor, Moon, Sun, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { useLogout } from '../../api/auth';
import { WhoAreYouDialog } from '../../features/me/WhoAreYouDialog';
import { useMe } from '../../features/me/useMe';
import { THEME_PREFS, useThemePref, type ThemePref } from '../../lib/theme';
import { Avatar } from '../data/Avatar';
import { Button } from '../ui/Button';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/Popover';
import { cn } from '../../lib/cn';

const THEME_OPTIONS: Record<ThemePref, { label: string; Icon: LucideIcon }> = {
  system: { label: 'System', Icon: Monitor },
  light: { label: 'Light', Icon: Sun },
  dark: { label: 'Dark', Icon: Moon },
};

function ThemeSetting() {
  const [pref, setPref] = useThemePref();
  return (
    <div role="radiogroup" aria-label="Theme" className="flex rounded-control border border-border">
      {THEME_PREFS.map((value) => {
        const { label, Icon } = THEME_OPTIONS[value];
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={pref === value}
            onClick={() => setPref(value)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1 px-2 py-1 text-xs first:rounded-l-control last:rounded-r-control',
              pref === value ? 'bg-accent text-accent-fg' : 'text-fg-secondary hover:bg-surface',
            )}
          >
            <Icon size={12} aria-hidden="true" /> {label}
          </button>
        );
      })}
    </div>
  );
}

interface Props {
  showLogout: boolean;
  user?: AuthUser | undefined;
}

/** Theme, "who am I" and sign out in one menu; it is always available, signed in or not. */
export function AccountMenu({ showLogout, user }: Props) {
  const logout = useLogout();
  const { me, users, fromLogin, setMeId } = useMe();
  const [picking, setPicking] = useState(false);
  const name = user?.displayName ?? me?.displayName ?? 'Menu';
  const avatarUrl = user?.avatarUrl ?? me?.avatarUrl;

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" aria-label={`Account menu for ${name}`}>
            <Avatar name={name} avatarUrl={avatarUrl} size={20} />
            <span className="hidden max-w-[10rem] truncate sm:inline">{name}</span>
            <ChevronDown size={12} aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="flex w-64 flex-col gap-3">
          {user ? (
            <div>
              <p className="truncate font-medium">{user.displayName}</p>
              <p className="truncate text-xs text-fg-secondary">
                @{user.username} · {user.provider === 'GITHUB' ? 'GitHub' : 'GitLab'} ·{' '}
                {user.role === 'ADMIN' ? 'Admin' : 'Member'}
              </p>
            </div>
          ) : null}
          {!fromLogin ? (
            <div>
              <p className="text-xs text-fg-secondary">Viewing as</p>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate">{me ? me.displayName : 'Nobody picked yet'}</span>
                <Button size="sm" variant="secondary" onClick={() => setPicking(true)}>
                  {me ? 'Change' : 'Pick'}
                </Button>
              </div>
            </div>
          ) : null}
          <div className="flex flex-col gap-1">
            <span className="text-xs text-fg-secondary">Theme</span>
            <ThemeSetting />
          </div>
          {user || showLogout ? (
            <Button variant="secondary" size="sm" onClick={() => logout.mutate()}>
              <LogOut size={14} aria-hidden="true" /> Sign out
            </Button>
          ) : null}
        </PopoverContent>
      </Popover>
      <WhoAreYouDialog
        open={picking}
        onOpenChange={setPicking}
        users={users}
        onPick={(u) => {
          setMeId(u.id);
          setPicking(false);
        }}
      />
    </>
  );
}
