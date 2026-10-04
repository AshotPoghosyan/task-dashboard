import { describe, expect, it } from 'vitest';
import {
  attentionLabel,
  compareAttention,
  getAttentionReasons,
  type AttentionInput,
} from './attention.js';
import { isMyMergeRequest, isMyTask } from './mine.js';

const NOW = new Date('2026-10-10T12:00:00Z');
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();

function mr(over: Partial<AttentionInput> = {}): AttentionInput {
  return {
    status: 'IN_REVIEW',
    isDraft: false,
    updatedAtRemote: daysAgo(1),
    author: { id: 'author' },
    reviewers: [{ user: { id: 'rev' }, state: 'APPROVED' }],
    ...over,
  };
}
const kinds = (input: AttentionInput, me: string | null) =>
  getAttentionReasons(input, me, 7, NOW).map((r) => r.kind);

describe('getAttentionReasons', () => {
  it('flags a review that is waiting for the current user', () => {
    const input = mr({ reviewers: [{ user: { id: 'me' }, state: 'REQUESTED' }] });
    expect(kinds(input, 'me')).toEqual(['REVIEW_REQUESTED']);
    expect(kinds(input, 'someone-else')).toEqual([]);
  });

  it('does not flag a review the user already gave', () => {
    const input = mr({ reviewers: [{ user: { id: 'me' }, state: 'APPROVED' }] });
    expect(kinds(input, 'me')).toEqual([]);
  });

  it('flags changes requested only for the author', () => {
    const input = mr({ reviewers: [{ user: { id: 'rev' }, state: 'CHANGES_REQUESTED' }] });
    expect(kinds(input, 'author')).toEqual(['CHANGES_REQUESTED']);
    expect(kinds(input, 'rev')).toEqual([]);
  });

  it('flags an open, non-draft MR without reviewers', () => {
    expect(kinds(mr({ status: 'OPEN', reviewers: [] }), null)).toEqual(['NO_REVIEWER']);
  });

  it('never flags a draft for missing reviewers', () => {
    expect(kinds(mr({ status: 'DRAFT', isDraft: true, reviewers: [] }), null)).toEqual([]);
    expect(kinds(mr({ status: 'OPEN', isDraft: true, reviewers: [] }), null)).toEqual([]);
  });

  it('flags stale MRs only after more than STALE_DAYS', () => {
    expect(kinds(mr({ updatedAtRemote: daysAgo(7) }), null)).toEqual([]);
    const reasons = getAttentionReasons(mr({ updatedAtRemote: daysAgo(9) }), null, 7, NOW);
    expect(reasons).toEqual([{ kind: 'STALE', days: 9 }]);
    expect(attentionLabel(reasons[0]!)).toBe('Stale 9d');
  });

  it('honours a custom stale threshold', () => {
    const input = mr({ updatedAtRemote: daysAgo(4) });
    expect(getAttentionReasons(input, null, 3, NOW)).toHaveLength(1);
    expect(getAttentionReasons(input, null, 5, NOW)).toHaveLength(0);
  });

  it('ignores merged and closed MRs', () => {
    for (const status of ['MERGED', 'CLOSED'] as const) {
      expect(kinds(mr({ status, reviewers: [], updatedAtRemote: daysAgo(30) }), 'author')).toEqual(
        [],
      );
    }
  });

  it('applies only "No reviewer" and "Stale" when the user is unknown', () => {
    const input = mr({
      status: 'OPEN',
      reviewers: [],
      updatedAtRemote: daysAgo(10),
    });
    expect(kinds(input, null)).toEqual(['NO_REVIEWER', 'STALE']);
    const requested = mr({ reviewers: [{ user: { id: 'me' }, state: 'REQUESTED' }] });
    expect(kinds(requested, null)).toEqual([]);
  });

  it('can report several reasons at once', () => {
    const input = mr({
      reviewers: [
        { user: { id: 'me' }, state: 'REQUESTED' },
        { user: { id: 'x' }, state: 'CHANGES_REQUESTED' },
      ],
      updatedAtRemote: daysAgo(8),
    });
    expect(kinds(input, 'me')).toEqual(['REVIEW_REQUESTED', 'STALE']);
  });
});

describe('compareAttention', () => {
  const item = (
    id: string,
    kind: 'REVIEW_REQUESTED' | 'CHANGES_REQUESTED' | 'NO_REVIEWER' | 'STALE',
    d: number,
  ) => ({
    id,
    reasons: [{ kind }],
    updatedAtRemote: daysAgo(d),
  });

  it('orders: your review, changes requested, no reviewer, stale (oldest first)', () => {
    const list = [
      item('stale-new', 'STALE', 8),
      item('none', 'NO_REVIEWER', 1),
      item('stale-old', 'STALE', 20),
      item('changes', 'CHANGES_REQUESTED', 2),
      item('review', 'REVIEW_REQUESTED', 3),
    ];
    expect(list.sort(compareAttention).map((i) => i.id)).toEqual([
      'review',
      'changes',
      'none',
      'stale-old',
      'stale-new',
    ]);
  });

  it('ranks an item by its most urgent reason', () => {
    const both = {
      reasons: [{ kind: 'STALE' as const }, { kind: 'REVIEW_REQUESTED' as const }],
      updatedAtRemote: daysAgo(30),
    };
    const none = item('none', 'NO_REVIEWER', 1);
    expect([none, both].sort(compareAttention)[0]).toBe(both);
  });
});

describe('mine matching', () => {
  const me = { id: 'me', username: 'ann', displayName: 'Ann Lee' };

  it('matches MRs where I am author, assignee or reviewer', () => {
    const base = { author: { id: 'x' }, assignee: null, reviewers: [] };
    expect(isMyMergeRequest({ ...base, author: { id: 'me' } }, me)).toBe(true);
    expect(isMyMergeRequest({ ...base, assignee: { id: 'me' } }, me)).toBe(true);
    expect(isMyMergeRequest({ ...base, reviewers: [{ user: { id: 'me' } }] }, me)).toBe(true);
    expect(isMyMergeRequest(base, me)).toBe(false);
  });

  it('matches task assignees by username or display name, ignoring case', () => {
    expect(isMyTask({ assigneeName: 'ANN' }, me)).toBe(true);
    expect(isMyTask({ assigneeName: ' ann lee ' }, me)).toBe(true);
    expect(isMyTask({ assigneeName: 'bob' }, me)).toBe(false);
    expect(isMyTask({ assigneeName: null }, me)).toBe(false);
  });

  it('matches a task through a linked MR that is mine', () => {
    expect(isMyTask({ assigneeName: null, linkedMergeRequestsMine: true }, me)).toBe(true);
  });
});
