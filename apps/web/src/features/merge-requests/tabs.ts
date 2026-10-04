import type { MergeRequestCounts, MrStatus } from '@mrdash/shared';
import type { TabDef } from '../../components/data/StatusTabs';

export const MR_TAB_IDS = [
  'attention',
  'all',
  'open',
  'in-review',
  'draft',
  'merged',
  'closed',
] as const;
export type MrTab = (typeof MR_TAB_IDS)[number];

/** Needs attention is what people come here for, so it is the default (no `?tab=`). */
export const DEFAULT_TAB: MrTab = 'attention';

export const parseTab = (raw: string | null): MrTab =>
  MR_TAB_IDS.find((t) => t === raw) ?? DEFAULT_TAB;

const TAB_STATUS: Partial<Record<MrTab, MrStatus>> = {
  open: 'OPEN',
  'in-review': 'IN_REVIEW',
  draft: 'DRAFT',
  merged: 'MERGED',
  closed: 'CLOSED',
};

/** What the list API needs for a tab: the attention view, or a status filter, or neither (All). */
export function tabQuery(tab: MrTab): { view?: 'attention'; status?: MrStatus[] } {
  if (tab === 'attention') return { view: 'attention' };
  const status = TAB_STATUS[tab];
  return status ? { status: [status] } : {};
}

const LABELS: Record<MrTab, string> = {
  attention: 'Needs attention',
  all: 'All',
  open: 'Open',
  'in-review': 'In review',
  draft: 'Draft',
  merged: 'Merged',
  closed: 'Closed',
};

const COUNT_KEY: Record<MrTab, keyof MergeRequestCounts> = {
  attention: 'attention',
  all: 'all',
  open: 'open',
  'in-review': 'inReview',
  draft: 'draft',
  merged: 'merged',
  closed: 'closed',
};

export const mrTabs = (counts?: MergeRequestCounts): TabDef[] =>
  MR_TAB_IDS.map((id) => ({ id, label: LABELS[id], count: counts?.[COUNT_KEY[id]] }));

export const MR_TAB_HELP = [
  {
    term: 'Needs attention',
    text: 'Something is waiting on someone: a review for you, changes on your MR, no reviewer yet, or no activity for a while.',
  },
  { term: 'All', text: 'Every merge request, newest update first.' },
  { term: 'Open', text: 'Ready for review, but nobody has been asked to review it yet.' },
  { term: 'In review', text: 'Someone has been asked to review it, or has already started.' },
  { term: 'Draft', text: 'Work in progress. Not ready for review.' },
  { term: 'Merged', text: 'The change is in the target branch.' },
  { term: 'Closed', text: 'Closed without merging.' },
];
