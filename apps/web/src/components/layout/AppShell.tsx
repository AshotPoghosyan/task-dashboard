import type { AuthUser } from '@mrdash/shared';
import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

interface AppShellProps {
  showLogout?: boolean;
  /** The signed-in OAuth user; absent for the shared password or when no login is required. */
  user?: AuthUser | undefined;
}

export function AppShell({ showLogout = false, user }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="flex h-screen bg-bg text-fg">
      <Sidebar
        isAdmin={user?.role === 'ADMIN'}
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar showLogout={showLogout} user={user} />
        <main id="main" className="min-h-0 flex-1 overflow-auto p-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
