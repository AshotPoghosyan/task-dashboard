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

/** UTC instant at which local calendar day `y-m-d` (month 0-based, may overflow) begins in `timeZone`. */
function zonedMidnight(timeZone: string, y: number, m: number, d: number): Date {
  const guess = Date.UTC(y, m, d);
  // Re-evaluate the offset at the corrected instant so DST transitions land correctly.
  const first = guess - zoneOffsetMs(timeZone, new Date(guess));
  return new Date(guess - zoneOffsetMs(timeZone, new Date(first)));
}

function localDate(timeZone: string, now: Date): { y: number; m: number; d: number } {
  const local = new Date(now.getTime() + zoneOffsetMs(timeZone, now));
  return { y: local.getUTCFullYear(), m: local.getUTCMonth(), d: local.getUTCDate() };
}

/** UTC instant at which "today" begins in `timeZone`. */
export function startOfTodayInZone(timeZone: string, now: Date = new Date()): Date {
  const { y, m, d } = localDate(timeZone, now);
  return zonedMidnight(timeZone, y, m, d);
}

/** UTC instant at which "tomorrow" begins in `timeZone`. */
export function startOfTomorrowInZone(timeZone: string, now: Date = new Date()): Date {
  const { y, m, d } = localDate(timeZone, now);
  return zonedMidnight(timeZone, y, m, d + 1);
}

/** UTC instant at which the current ISO week (Monday start) begins in `timeZone`. */
export function startOfWeekInZone(timeZone: string, now: Date = new Date()): Date {
  const { y, m, d } = localDate(timeZone, now);
  const weekday = new Date(Date.UTC(y, m, d)).getUTCDay(); // 0 = Sunday
  return zonedMidnight(timeZone, y, m, d - ((weekday + 6) % 7));
}
