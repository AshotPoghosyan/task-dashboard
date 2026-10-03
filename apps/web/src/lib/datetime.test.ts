import { formatDate, formatDateTime } from './datetime';

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
