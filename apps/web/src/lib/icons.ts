import {
  CircleDashed,
  Eye,
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
  GitPullRequestDraft,
  type LucideIcon,
} from 'lucide-react';

/** Resolves the icon names from shared `STATUS_DISPLAY` to components. */
export const STATUS_ICONS: Record<string, LucideIcon> = {
  GitMerge,
  Eye,
  GitPullRequest,
  GitPullRequestDraft,
  GitPullRequestClosed,
  CircleDashed,
};
