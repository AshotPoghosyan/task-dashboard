import { describe, expect, it } from 'vitest';
import { aggregateTaskStatus } from './aggregate.js';
import { getStatusDisplay, STATUS_DISPLAY } from './display.js';
import { mapGitHubStatus, mapGitLabStatus } from './mapping.js';
import { TASK_STATUSES } from '../enums.js';

describe('mapGitLabStatus', () => {
  const base = { state: 'opened', draft: false, reviewers: [] } as const;
  it('merged wins over draft and reviewers', () => {
    expect(mapGitLabStatus({ ...base, state: 'merged', draft: true, reviewers: [1] })).toBe(
      'MERGED',
    );
  });
  it('closed', () => expect(mapGitLabStatus({ ...base, state: 'closed' })).toBe('CLOSED'));
  it('draft', () => expect(mapGitLabStatus({ ...base, draft: true })).toBe('DRAFT'));
  it('draft with reviewers stays DRAFT', () => {
    expect(mapGitLabStatus({ ...base, draft: true, reviewers: [1] })).toBe('DRAFT');
  });
  it('reviewers -> IN_REVIEW', () =>
    expect(mapGitLabStatus({ ...base, reviewers: [1] })).toBe('IN_REVIEW'));
  it('plain open', () => expect(mapGitLabStatus(base)).toBe('OPEN'));
});

describe('mapGitHubStatus', () => {
  const base = { state: 'open', merged_at: null, draft: false, requested_reviewers: [] } as const;
  it('merged_at set -> MERGED even though state is closed', () => {
    expect(mapGitHubStatus({ ...base, state: 'closed', merged_at: '2026-01-01T00:00:00Z' })).toBe(
      'MERGED',
    );
  });
  it('closed without merge -> CLOSED', () => {
    expect(mapGitHubStatus({ ...base, state: 'closed' })).toBe('CLOSED');
  });
  it('draft', () => expect(mapGitHubStatus({ ...base, draft: true })).toBe('DRAFT'));
  it('draft with requested reviewers stays DRAFT', () => {
    expect(mapGitHubStatus({ ...base, draft: true, requested_reviewers: [1] })).toBe('DRAFT');
  });
  it('requested reviewers -> IN_REVIEW', () => {
    expect(mapGitHubStatus({ ...base, requested_reviewers: [1] })).toBe('IN_REVIEW');
  });
  it('submitted review -> IN_REVIEW', () => {
    expect(mapGitHubStatus({ ...base, reviews: [1] })).toBe('IN_REVIEW');
  });
  it('empty reviews list -> OPEN', () =>
    expect(mapGitHubStatus({ ...base, reviews: [] })).toBe('OPEN'));
  it('no reviews field -> OPEN', () => expect(mapGitHubStatus(base)).toBe('OPEN'));
});

describe('aggregateTaskStatus', () => {
  it('override takes precedence over everything', () => {
    expect(aggregateTaskStatus('CLOSED', ['MERGED'])).toBe('CLOSED');
    expect(aggregateTaskStatus('NO_MR', [])).toBe('NO_MR');
  });
  it('null/undefined override is ignored', () => {
    expect(aggregateTaskStatus(null, ['OPEN'])).toBe('OPEN');
    expect(aggregateTaskStatus(undefined, ['OPEN'])).toBe('OPEN');
  });
  it('empty list -> NO_MR', () => expect(aggregateTaskStatus(null, [])).toBe('NO_MR'));
  it('all merged -> MERGED', () =>
    expect(aggregateTaskStatus(null, ['MERGED', 'MERGED'])).toBe('MERGED'));
  it('all closed -> CLOSED', () => expect(aggregateTaskStatus(null, ['CLOSED'])).toBe('CLOSED'));
  it('mixed merged/closed -> CLOSED', () => {
    expect(aggregateTaskStatus(null, ['MERGED', 'CLOSED'])).toBe('CLOSED');
  });
  it('open MRs ignore merged/closed ones', () => {
    expect(aggregateTaskStatus(null, ['MERGED', 'CLOSED', 'IN_REVIEW'])).toBe('IN_REVIEW');
  });
  it('picks least advanced open status', () => {
    expect(aggregateTaskStatus(null, ['IN_REVIEW', 'DRAFT', 'OPEN'])).toBe('DRAFT');
    expect(aggregateTaskStatus(null, ['IN_REVIEW', 'OPEN'])).toBe('OPEN');
    expect(aggregateTaskStatus(null, ['IN_REVIEW', 'IN_REVIEW'])).toBe('IN_REVIEW');
  });
});

describe('status display', () => {
  it('has metadata for every status', () => {
    for (const s of TASK_STATUSES) {
      expect(getStatusDisplay(s)).toBe(STATUS_DISPLAY[s]);
      expect(STATUS_DISPLAY[s].label).not.toBe('');
    }
  });
});
