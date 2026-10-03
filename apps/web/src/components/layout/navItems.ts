import { GitPullRequest, ListChecks, RefreshCw, type LucideIcon } from 'lucide-react';

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
