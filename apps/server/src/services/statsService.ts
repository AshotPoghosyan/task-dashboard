import type { Stats } from '@mrdash/shared';
import { countStats } from '../repositories/statsRepository.js';
import { startOfTodayInZone, startOfTomorrowInZone, startOfWeekInZone } from '../utils/timezone.js';

export const STATS_TTL_MS = 10_000;

let cache: { key: string; value: Stats; expiresAt: number } | undefined;

/** Drop the cached stats; call whenever merge requests change (sync, webhooks). */
export function invalidateStatsCache(): void {
  cache = undefined;
}

export async function getStats(timeZone: string, now: Date = new Date()): Promise<Stats> {
  const key = timeZone;
  if (cache && cache.key === key && cache.expiresAt > now.getTime()) return cache.value;

  const counts = await countStats({
    todayStart: startOfTodayInZone(timeZone, now),
    tomorrowStart: startOfTomorrowInZone(timeZone, now),
    weekStart: startOfWeekInZone(timeZone, now),
  });
  const value: Stats = {
    openMrs: counts.draft + counts.open + counts.inReview,
    pendingReviews: counts.inReview,
    mergedToday: counts.mergedToday,
    draft: counts.draft,
    closedThisWeek: counts.closedThisWeek,
  };
  cache = { key, value, expiresAt: now.getTime() + STATS_TTL_MS };
  return value;
}
