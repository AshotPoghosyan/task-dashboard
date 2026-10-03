import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { cn } from '../../lib/cn';
import { Button } from '../ui/Button';
import { NAV_ITEMS } from './navItems';

interface NavListProps {
  collapsed?: boolean;
  onNavigate?: () => void;
}

export function NavList({ collapsed = false, onNavigate }: NavListProps) {
  return (
    <ul className="flex flex-col gap-1">
      {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
        <li key={to}>
          <NavLink
            to={to}
            end={to === '/'}
            onClick={onNavigate}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              cn(
                'flex h-8 items-center gap-2 rounded-control px-2 text-sm hover:bg-raised',
                isActive ? 'bg-raised text-fg' : 'text-fg-secondary',
              )
            }
          >
            <Icon size={16} aria-hidden="true" />
            <span className={cn(collapsed && 'sr-only')}>{label}</span>
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

/** Desktop sidebar (≥1024px). Below that the shell shows a drawer instead. */
export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  return (
    <aside
      className={cn(
        'hidden shrink-0 flex-col justify-between border-r border-border bg-surface p-2 lg:flex',
        collapsed ? 'w-14' : 'w-56',
      )}
    >
      <nav aria-label="Main">
        <NavList collapsed={collapsed} />
      </nav>
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggle}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-expanded={!collapsed}
      >
        {collapsed ? (
          <PanelLeftOpen size={16} aria-hidden="true" />
        ) : (
          <PanelLeftClose size={16} aria-hidden="true" />
        )}
      </Button>
    </aside>
  );
}
