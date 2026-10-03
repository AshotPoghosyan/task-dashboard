import { getPrisma } from '../db/prisma.js';

export interface StatsWindows {
  todayStart: Date;
  tomorrowStart: Date;
  weekStart: Date;
}

export interface StatsCounts {
  draft: number;
  open: number;
  inReview: number;
  mergedToday: number;
  closedThisWeek: number;
}

/** Counts used by the dashboard stat cards, fetched concurrently. */
export async function countStats(w: StatsWindows): Promise<StatsCounts> {
  const mr = getPrisma().mergeRequest;
  const [draft, open, inReview, mergedToday, closedThisWeek] = await Promise.all([
    mr.count({ where: { status: 'DRAFT' } }),
    mr.count({ where: { status: 'OPEN' } }),
    mr.count({ where: { status: 'IN_REVIEW' } }),
    mr.count({
      where: { status: 'MERGED', mergedAt: { gte: w.todayStart, lt: w.tomorrowStart } },
    }),
    mr.count({ where: { status: 'CLOSED', closedAt: { gte: w.weekStart } } }),
  ]);
  return { draft, open, inReview, mergedToday, closedThisWeek };
}
