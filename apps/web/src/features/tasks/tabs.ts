import type { TaskCounts, TaskStatus } from '@mrdash/shared';
import type { TabDef } from '../../components/data/StatusTabs';

export const TASK_TAB_IDS = [
  'all',
  'open',
  'in-review',
  'draft',
  'merged',
  'closed',
  'no-mr',
] as const;
export type TaskTab = (typeof TASK_TAB_IDS)[number];

export const DEFAULT_TAB: TaskTab = 'all';

export const parseTab = (raw: string | null): TaskTab =>
  TASK_TAB_IDS.find((t) => t === raw) ?? DEFAULT_TAB;

const TAB_STATUS: Partial<Record<TaskTab, TaskStatus>> = {
  open: 'OPEN',
  'in-review': 'IN_REVIEW',
  draft: 'DRAFT',
  merged: 'MERGED',
  closed: 'CLOSED',
  'no-mr': 'NO_MR',
};

export const tabStatus = (tab: TaskTab): TaskStatus[] | undefined => {
  const status = TAB_STATUS[tab];
  return status ? [status] : undefined;
};

const LABELS: Record<TaskTab, string> = {
  all: 'All',
  open: 'Open',
  'in-review': 'In review',
  draft: 'Draft',
  merged: 'Merged',
  closed: 'Closed',
  'no-mr': 'No MR',
};

const COUNT_KEY: Record<TaskTab, keyof TaskCounts> = {
  all: 'all',
  open: 'open',
  'in-review': 'inReview',
  draft: 'draft',
  merged: 'merged',
  closed: 'closed',
  'no-mr': 'noMr',
};

export const taskTabs = (counts?: TaskCounts): TabDef[] =>
  TASK_TAB_IDS.map((id) => ({ id, label: LABELS[id], count: counts?.[COUNT_KEY[id]] }));

export const TASK_TAB_HELP = [
  { term: 'All', text: 'Every task, most recently updated first.' },
  { term: 'Open', text: 'Has a merge request that is ready for review.' },
  { term: 'In review', text: 'Its merge request has reviewers.' },
  { term: 'Draft', text: 'Its merge request is still work in progress.' },
  { term: 'Merged', text: 'Its merge requests are all merged.' },
  { term: 'Closed', text: 'Its merge requests were closed without merging.' },
  { term: 'No MR', text: 'No merge request is linked to it yet.' },
];
