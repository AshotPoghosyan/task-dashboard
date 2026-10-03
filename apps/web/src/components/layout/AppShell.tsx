import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

export function AppShell({ showLogout = false }: { showLogout?: boolean }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="flex h-screen bg-bg text-fg">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar showLogout={showLogout} />
        <main id="main" className="min-h-0 flex-1 overflow-auto p-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
