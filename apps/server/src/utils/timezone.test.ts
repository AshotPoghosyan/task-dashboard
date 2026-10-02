import { describe, expect, it } from 'vitest';
import { startOfTodayInZone, startOfTomorrowInZone, startOfWeekInZone } from './timezone.js';

const iso = (d: Date) => d.toISOString();

describe('timezone helpers', () => {
  it('starts the day at local midnight (UTC+4)', () => {
    const now = new Date('2026-10-01T22:30:00Z'); // 02:30 on Oct 2 in Yerevan
    expect(iso(startOfTodayInZone('Asia/Yerevan', now))).toBe('2026-10-01T20:00:00.000Z');
    expect(iso(startOfTomorrowInZone('Asia/Yerevan', now))).toBe('2026-10-02T20:00:00.000Z');
  });

  it('is exactly at midnight boundary inclusive', () => {
    const now = new Date('2026-10-01T20:00:00Z');
    expect(iso(startOfTodayInZone('Asia/Yerevan', now))).toBe('2026-10-01T20:00:00.000Z');
    const before = new Date('2026-10-01T19:59:59Z');
    expect(iso(startOfTodayInZone('Asia/Yerevan', before))).toBe('2026-09-30T20:00:00.000Z');
  });

  it('handles negative offsets', () => {
    const now = new Date('2026-01-15T03:00:00Z'); // Jan 14 22:00 in New York (UTC-5)
    expect(iso(startOfTodayInZone('America/New_York', now))).toBe('2026-01-14T05:00:00.000Z');
  });

  it('handles DST days (23 hour day)', () => {
    const now = new Date('2026-03-08T18:00:00Z'); // US spring forward
    expect(iso(startOfTodayInZone('America/New_York', now))).toBe('2026-03-08T05:00:00.000Z');
    expect(iso(startOfTomorrowInZone('America/New_York', now))).toBe('2026-03-09T04:00:00.000Z');
  });

  it('starts the week on Monday', () => {
    const sunday = new Date('2026-10-04T10:00:00Z');
    expect(iso(startOfWeekInZone('Asia/Yerevan', sunday))).toBe('2026-09-27T20:00:00.000Z');
    const monday = new Date('2026-10-05T10:00:00Z');
    expect(iso(startOfWeekInZone('Asia/Yerevan', monday))).toBe('2026-10-04T20:00:00.000Z');
  });
});
