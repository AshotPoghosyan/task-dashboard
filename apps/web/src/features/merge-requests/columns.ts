/**
 * Responsive column plan, shared by header, rows and skeleton. Columns are hidden in this
 * order as the screen narrows: Linked task and Target branch (< 1280px), Author (< 1024px),
 * Reviewers and Updated (< 768px). Hidden fields appear in the expanded row instead.
 * The DOM order is: toggle, MR, Title, Author, Reviewers, Status, Target branch, Updated, Linked task.
 */
export const GRID = [
  'grid-cols-[1.5rem_minmax(0,1fr)_6.5rem]',
  'md:grid-cols-[1.5rem_8rem_minmax(0,1fr)_6rem_6.5rem_5.5rem]',
  'lg:grid-cols-[1.5rem_8rem_minmax(0,1fr)_7.5rem_6rem_6.5rem_5.5rem]',
  'xl:grid-cols-[8rem_minmax(0,1fr)_7.5rem_6rem_6.5rem_6rem_5.5rem_6.5rem]',
].join(' ');

export const SHOW = {
  toggle: 'xl:hidden',
  mr: 'hidden md:block',
  author: 'hidden lg:block',
  reviewers: 'hidden md:block',
  target: 'hidden xl:block',
  updated: 'hidden md:block',
  linked: 'hidden xl:block',
} as const;

export const ROW_HEIGHT = 48;

export const HEADERS: { label: string; className?: string; sort?: 'updated' }[] = [
  { label: 'Details', className: SHOW.toggle },
  { label: 'MR', className: SHOW.mr },
  { label: 'Title' },
  { label: 'Author', className: SHOW.author },
  { label: 'Reviewers', className: SHOW.reviewers },
  { label: 'Status' },
  { label: 'Target branch', className: SHOW.target },
  { label: 'Updated', className: SHOW.updated, sort: 'updated' },
  { label: 'Linked task', className: SHOW.linked },
];
