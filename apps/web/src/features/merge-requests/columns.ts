/** Grid template shared by header, rows and skeleton. Low-priority columns drop on small screens. */
export const GRID =
  'grid-cols-[2rem_minmax(12rem,1fr)_6.5rem] lg:grid-cols-[2rem_10rem_5rem_minmax(14rem,1fr)_9rem_7rem_6.5rem_12rem_5rem_8rem]';
export const LOW = 'hidden lg:block';
export const ROW_HEIGHT = 44;

export const HEADERS: { label: string; className?: string }[] = [
  { label: 'Provider' },
  { label: 'Repository', className: LOW },
  { label: 'MR', className: LOW },
  { label: 'Title' },
  { label: 'Author', className: LOW },
  { label: 'Reviewers', className: LOW },
  { label: 'Status' },
  { label: 'Branches', className: LOW },
  { label: 'Age', className: LOW },
  { label: 'Linked task', className: LOW },
];
