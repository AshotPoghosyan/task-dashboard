import type { TaskStatus } from '../enums.js';

export interface StatusDisplay {
  label: string;
  /** lucide-react icon name; the UI resolves it to a component. */
  icon: string;
  /** Design token name (see styles/tokens.css), never a raw color. */
  colorToken: string;
}

/** Valid for both MrStatus and TaskStatus (MrStatus is a subset). */
export const STATUS_DISPLAY: Record<TaskStatus, StatusDisplay> = {
  MERGED: { label: 'Merged', icon: 'GitMerge', colorToken: 'status-merged' },
  IN_REVIEW: { label: 'In review', icon: 'Eye', colorToken: 'status-in-review' },
  OPEN: { label: 'Open', icon: 'GitPullRequest', colorToken: 'status-open' },
  DRAFT: { label: 'Draft', icon: 'GitPullRequestDraft', colorToken: 'status-draft' },
  CLOSED: { label: 'Closed', icon: 'GitPullRequestClosed', colorToken: 'status-closed' },
  NO_MR: { label: 'No MR', icon: 'CircleDashed', colorToken: 'status-no-mr' },
};

export function getStatusDisplay(status: TaskStatus): StatusDisplay {
  return STATUS_DISPLAY[status];
}
