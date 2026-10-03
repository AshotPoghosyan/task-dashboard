import { formatDate, formatDateTime, relativeAge } from './datetime';

describe('formatDateTime', () => {
  it('renders UTC timestamps in the app timezone (Asia/Yerevan, UTC+4)', () => {
    expect(formatDateTime('2026-01-01T21:30:00Z')).toBe('2 Jan 2026, 01:30');
  });
});

describe('formatDate', () => {
  it('rolls over at midnight Asia/Yerevan, not UTC', () => {
    expect(formatDate('2026-01-01T19:59:59Z')).toBe('1 Jan 2026');
    expect(formatDate('2026-01-01T20:00:00Z')).toBe('2 Jan 2026');
  });
});

describe('relativeAge', () => {
  const now = Date.parse('2026-10-10T12:00:00Z');
  const ago = (ms: number) => new Date(now - ms).toISOString();
  it('formats compact ages', () => {
    expect(relativeAge(ago(30_000), now)).toBe('just now');
    expect(relativeAge(ago(5 * 60_000), now)).toBe('5m ago');
    expect(relativeAge(ago(3 * 3600_000), now)).toBe('3h ago');
    expect(relativeAge(ago(3 * 86400_000), now)).toBe('3d ago');
    expect(relativeAge(ago(15 * 86400_000), now)).toBe('2w ago');
  });
});
