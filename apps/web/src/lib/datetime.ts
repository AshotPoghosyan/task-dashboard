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
