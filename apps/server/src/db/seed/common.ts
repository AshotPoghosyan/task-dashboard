import type { MrStatus, Prisma, TaskStatus } from '@prisma/client';

/** Deterministic PRNG (mulberry32) so seeds are reproducible. */
export function createRng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rng = () => number;

export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)] as T;
}

/** Offset (ms) of `timeZone` from UTC at the given instant. */
function zoneOffsetMs(timeZone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);
  const get = (type: string): number => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** UTC instant at which "today" begins in `timeZone`. */
export function startOfTodayInZone(timeZone: string, now: Date = new Date()): Date {
  const offset = zoneOffsetMs(timeZone, now);
  const local = new Date(now.getTime() + offset);
  const localMidnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  return new Date(localMidnight - offset);
}

const MR_PRIORITY: MrStatus[] = ['DRAFT', 'OPEN', 'IN_REVIEW'];

/**
 * Minimal task status rollup used only to seed plausible data.
 * The canonical implementation lives in `packages/shared` (Phase 3).
 */
export function seedTaskStatus(statuses: MrStatus[]): TaskStatus {
  if (statuses.length === 0) return 'NO_MR';
  if (statuses.every((s) => s === 'MERGED')) return 'MERGED';
  const open = statuses.filter((s) => MR_PRIORITY.includes(s));
  if (open.length === 0) return 'CLOSED';
  return open.sort((a, b) => MR_PRIORITY.indexOf(a) - MR_PRIORITY.indexOf(b))[0] as TaskStatus;
}

export interface MrTimes {
  createdAtRemote: Date;
  updatedAtRemote: Date;
  mergedAt: Date | null;
  closedAt: Date | null;
}

export function mrTimes(
  status: MrStatus,
  rng: Rng,
  now: Date,
  mergedToday: boolean,
  todayStart: Date,
): MrTimes {
  const day = 86_400_000;
  const createdAtRemote = new Date(now.getTime() - (2 + rng() * 40) * day);
  let mergedAt: Date | null = null;
  let closedAt: Date | null = null;
  let updatedAtRemote = new Date(
    createdAtRemote.getTime() + rng() * (now.getTime() - createdAtRemote.getTime()),
  );
  if (status === 'MERGED') {
    mergedAt = mergedToday
      ? new Date(todayStart.getTime() + rng() * Math.max(1, now.getTime() - todayStart.getTime()))
      : new Date(todayStart.getTime() - (1 + rng() * 20) * day);
    if (mergedAt < createdAtRemote) mergedAt = new Date(createdAtRemote.getTime() + 3_600_000);
    updatedAtRemote = mergedAt;
  } else if (status === 'CLOSED') {
    closedAt = new Date(todayStart.getTime() - (1 + rng() * 10) * day);
    if (closedAt < createdAtRemote) closedAt = new Date(createdAtRemote.getTime() + 3_600_000);
    updatedAtRemote = closedAt;
  }
  return { createdAtRemote, updatedAtRemote, mergedAt, closedAt };
}

export const TARGET_BRANCHES = ['main', 'develop', 'release/1.4', 'release/1.5'] as const;

export const TITLE_VERBS = [
  'Add',
  'Fix',
  'Refactor',
  'Improve',
  'Remove',
  'Update',
  'Optimize',
] as const;
export const TITLE_NOUNS = [
  'login flow',
  'invoice export',
  'search index',
  'notification settings',
  'user avatar upload',
  'payment retries',
  'dashboard filters',
  'audit log',
  'cache invalidation',
  'onboarding wizard',
  'rate limiting',
  'email templates',
] as const;

export type Tx = Prisma.TransactionClient;
