import type { MrStatus, TaskStatus } from '../enums.js';

/** Open statuses from least to most advanced. */
const OPEN_ORDER = ['DRAFT', 'OPEN', 'IN_REVIEW'] as const;

export function aggregateTaskStatus(
  override: TaskStatus | null | undefined,
  linkedMrStatuses: readonly MrStatus[],
): TaskStatus {
  if (override) return override;
  if (linkedMrStatuses.length === 0) return 'NO_MR';

  const open = linkedMrStatuses.filter((s) => s !== 'MERGED' && s !== 'CLOSED');
  if (open.length === 0) {
    return linkedMrStatuses.includes('CLOSED') ? 'CLOSED' : 'MERGED';
  }
  // `open` is non-empty and only holds OPEN_ORDER values, so a match always exists.
  return OPEN_ORDER.find((s) => open.includes(s)) as TaskStatus;
}
