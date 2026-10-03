import { GitPullRequest, ListChecks, RefreshCw, Users, type LucideIcon } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Tasks', icon: ListChecks },
  { to: '/merge-requests', label: 'Merge Requests', icon: GitPullRequest },
  { to: '/sync', label: 'Sync', icon: RefreshCw },
];

export const ADMIN_NAV_ITEMS: NavItem[] = [{ to: '/settings/users', label: 'Users', icon: Users }];

/** Admin-only entries are listed only for admins; the server enforces the same rule. */
export const navItemsFor = (isAdmin: boolean): NavItem[] =>
  isAdmin ? [...NAV_ITEMS, ...ADMIN_NAV_ITEMS] : NAV_ITEMS;
