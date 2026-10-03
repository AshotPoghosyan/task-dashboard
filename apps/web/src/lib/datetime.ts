/** Display timezone; mirrors the server's APP_TIMEZONE (set VITE_APP_TIMEZONE to change). */
export const APP_TIMEZONE: string =
  (import.meta.env.VITE_APP_TIMEZONE as string | undefined) || 'Asia/Yerevan';

const formatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: APP_TIMEZONE,
  dateStyle: 'medium',
  timeStyle: 'short',
});

/** Formats a UTC ISO timestamp in APP_TIMEZONE. */
export const formatDateTime = (iso: string): string => formatter.format(new Date(iso));

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: APP_TIMEZONE,
  dateStyle: 'medium',
});

/** Formats a UTC ISO timestamp as a date in APP_TIMEZONE. */
export const formatDate = (iso: string): string => dateFormatter.format(new Date(iso));

/** Compact relative age such as "3d ago"; anything under a minute is "just now". */
export function relativeAge(iso: string, now: number = Date.now()): string {
  const minutes = Math.floor((now - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days < 7 ? `${days}d ago` : `${Math.floor(days / 7)}w ago`;
}
