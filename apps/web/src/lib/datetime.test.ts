import { formatDateTime } from './datetime';

describe('formatDateTime', () => {
  it('renders UTC timestamps in the app timezone (Asia/Yerevan, UTC+4)', () => {
    expect(formatDateTime('2026-01-01T21:30:00Z')).toBe('2 Jan 2026, 01:30');
  });
});
