import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockLayout, renderWithProviders, stubApi } from '../../tasks/__tests__/testUtils';
import MergeRequestsPage from '../MergeRequestsPage';
import { makeMr, user } from './mrUtils';

const counts = { attention: 3, all: 20, open: 8, inReview: 3, draft: 2, merged: 5, closed: 2 };
const options = {
  assignees: [],
  branches: ['main'],
  repositories: [{ id: 'r1', provider: 'GITLAB', fullPath: 'acme/group/web' }],
  users: [user('u1', 'Ada Lovelace'), user('u2', 'Grace Hopper')],
};
const syncStatus = {
  running: false,
  providers: { GITLAB: true, GITHUB: true },
  repositories: [
    {
      repositoryId: 'r1',
      provider: 'GITLAB',
      fullPath: 'acme/group/web',
      isActive: true,
      lastSyncedAt: '2026-10-03T10:00:00.000Z',
      lastRun: {
        id: 's1',
        status: 'FAILED',
        startedAt: '2026-10-03T10:00:00.000Z',
        finishedAt: null,
        itemsFetched: 0,
        itemsUpserted: 0,
        error: 'Bad token',
      },
    },
  ],
};

let restore: () => void;
beforeEach(() => (restore = mockLayout()));
afterEach(() => {
  localStorage.clear();
  restore();
  vi.unstubAllGlobals();
});

const handlers = (list: unknown = { items: [makeMr('a')], nextCursor: null }) => ({
  'GET /merge-requests': () => list,
  'GET /merge-requests/counts': () => counts,
  'GET /filters/options': () => options,
  'GET /sync/status': () => syncStatus,
});

const mrCall = (calls: { path: string; url: URL }[]) =>
  calls.filter((c) => c.path === '/merge-requests').at(-1);

describe('MergeRequestsPage', () => {
  it('shows skeletons, then rows with the new columns', async () => {
    const updatedAtRemote = new Date(Date.now() - 49 * 3_600_000).toISOString();
    stubApi(handlers({ items: [makeMr('a', { updatedAtRemote })], nextCursor: null }));
    renderWithProviders(<MergeRequestsPage />, '/?tab=all');
    expect(screen.getByRole('status', { name: 'Loading merge requests' })).toBeInTheDocument();
    expect(await screen.findByText('MR a')).toBeInTheDocument();
    // Provider icon + short repo name + number in one cell; the full path is the tooltip.
    expect(screen.getAllByText('web !12').length).toBeGreaterThan(0);
    expect(screen.getByRole('img', { name: 'GitLab' })).toBeInTheDocument();
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByLabelText('Approved')).toBeInTheDocument();
    expect(screen.getByText('main')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ship login' })).toHaveAttribute(
      'href',
      '/?q=Ship%20login',
    );
    expect(screen.getByText('2d ago')).toHaveAttribute('title');
    expect(screen.getByRole('columnheader', { name: /Updated/ })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
  });

  it('marks reviewers as approved, changes requested or waiting', async () => {
    const reviewers = [
      { user: user('u2', 'Grace Hopper'), state: 'APPROVED' as const },
      { user: user('u3', 'Alan Turing'), state: 'CHANGES_REQUESTED' as const },
      { user: user('u4', 'Edsger Dijkstra'), state: 'REQUESTED' as const },
    ];
    stubApi(handlers({ items: [makeMr('a', { reviewers })], nextCursor: null }));
    renderWithProviders(<MergeRequestsPage />);
    await screen.findByText('MR a');
    const list = screen.getByRole('list', { name: 'Reviewers' });
    expect(within(list).getByLabelText('Approved')).toBeInTheDocument();
    expect(within(list).getByLabelText('Changes requested')).toBeInTheDocument();
    expect(within(list).getByLabelText('Waiting')).toBeInTheDocument();
  });

  it('shows "No reviewer" when nobody is assigned', async () => {
    stubApi(handlers({ items: [makeMr('a', { reviewers: [] })], nextCursor: null }));
    renderWithProviders(<MergeRequestsPage />);
    await screen.findByText('MR a');
    expect(screen.getByText('No reviewer')).toBeInTheDocument();
  });

  describe('status tabs', () => {
    it('lists the seven tabs with counts and Needs attention selected by default', async () => {
      const { calls } = stubApi(handlers());
      renderWithProviders(<MergeRequestsPage />);
      await screen.findByText('MR a');
      const tabs = within(
        screen.getByRole('tablist', { name: 'Merge request status' }),
      ).getAllByRole('tab');
      await waitFor(() => expect(tabs[0]).toHaveTextContent('Needs attention3'));
      expect(tabs.map((t) => t.textContent)).toEqual([
        'Needs attention3',
        'All20',
        'Open8',
        'In review3',
        'Draft2',
        'Merged5',
        'Closed2',
      ]);
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
      expect(mrCall(calls)?.url.searchParams.get('view')).toBe('attention');
    });

    it('keeps the tab in the URL and asks the API for that status', async () => {
      const { calls } = stubApi(handlers());
      renderWithProviders(<MergeRequestsPage />);
      await screen.findByText('MR a');

      await userEvent.click(screen.getByRole('tab', { name: /In review/ }));
      expect(screen.getByTestId('search')).toHaveTextContent('?tab=in-review');
      await waitFor(() => expect(mrCall(calls)?.url.searchParams.get('status')).toBe('IN_REVIEW'));
      expect(mrCall(calls)?.url.searchParams.get('view')).toBeNull();

      await userEvent.click(screen.getByRole('tab', { name: /Needs attention/ }));
      expect(screen.getByTestId('search')).toHaveTextContent('');
    });

    it('reads the tab from the URL and moves between tabs with arrow keys', async () => {
      stubApi(handlers());
      renderWithProviders(<MergeRequestsPage />, '/?tab=all');
      await screen.findByText('MR a');
      const all = screen.getByRole('tab', { name: /^All/ });
      expect(all).toHaveAttribute('aria-selected', 'true');
      all.focus();
      await userEvent.keyboard('{ArrowRight}');
      expect(screen.getByRole('tab', { name: /^Open/ })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByTestId('search')).toHaveTextContent('?tab=open');
    });

    it('explains every status behind the "?" button', async () => {
      stubApi(handlers());
      renderWithProviders(<MergeRequestsPage />);
      await screen.findByText('MR a');
      await userEvent.click(screen.getByRole('button', { name: 'What do these tabs mean?' }));
      expect(await screen.findByText('Closed without merging.')).toBeInTheDocument();
      expect(screen.getByText(/Work in progress/)).toBeInTheDocument();
    });
  });

  it('shows the attention reasons as chips in the Needs attention tab', async () => {
    const reasons = [{ kind: 'STALE' as const, days: 9 }, { kind: 'NO_REVIEWER' as const }];
    stubApi(handlers({ items: [makeMr('a', { reasons })], nextCursor: null }));
    renderWithProviders(<MergeRequestsPage />);
    expect(await screen.findByText('Stale 9d')).toBeInTheDocument();
    expect(screen.getByText('No reviewer', { selector: 'span.shrink-0' })).toBeInTheDocument();
    // The attention order is fixed, so the Updated header is not a sort button there.
    expect(screen.queryByRole('button', { name: /Updated/ })).not.toBeInTheDocument();
  });

  it('shows "Nothing needs attention right now" with a link to All', async () => {
    stubApi(handlers({ items: [], nextCursor: null }));
    renderWithProviders(<MergeRequestsPage />);
    expect(await screen.findByText('Nothing needs attention right now')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'See all merge requests' }));
    expect(screen.getByTestId('search')).toHaveTextContent('?tab=all');
  });

  it('keeps secondary filters behind More filters and shows readable, removable chips', async () => {
    const { calls } = stubApi(handlers());
    renderWithProviders(<MergeRequestsPage />, '/?authorId=u1&provider=GITLAB&q=login');
    await screen.findByText('MR a');
    expect(screen.getByRole('button', { name: /More filters/ })).toHaveTextContent('2');
    const chips = screen.getByRole('list', { name: 'Active filters' });
    expect(chips).toHaveTextContent('Author: Ada Lovelace');
    expect(chips).toHaveTextContent('Provider: GitLab');
    const call = mrCall(calls);
    expect(call?.url.searchParams.get('authorId')).toBe('u1');
    expect(call?.url.searchParams.get('provider')).toBe('GITLAB');
    expect(call?.url.searchParams.get('q')).toBe('login');
    // The tab counts use the same filters.
    const counted = calls.find((c) => c.path === '/merge-requests/counts');
    expect(counted?.url.searchParams.get('authorId')).toBe('u1');
    expect(counted?.url.searchParams.get('status')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Remove filter Provider: GitLab' }));
    expect(screen.getByTestId('search')).not.toHaveTextContent('provider=');
    await userEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(screen.getByTestId('search')).toHaveTextContent('');
  });

  it('opens a popover with every secondary filter', async () => {
    stubApi(handlers());
    renderWithProviders(<MergeRequestsPage />);
    await screen.findByText('MR a');
    await userEvent.click(screen.getByRole('button', { name: /More filters/ }));
    for (const label of [
      'Provider',
      'Repository',
      'Author',
      'Assignee',
      'Reviewer',
      'Target branch',
    ]) {
      expect(
        await screen.findByRole('button', { name: new RegExp(`^${label}`) }),
      ).toBeInTheDocument();
    }
  });

  it('applies Only mine with the remembered person, and asks who you are first', async () => {
    const { calls } = stubApi(handlers());
    renderWithProviders(<MergeRequestsPage />);
    await screen.findByText('MR a');

    await userEvent.click(screen.getByRole('button', { name: 'Only mine' }));
    expect(await screen.findByRole('dialog', { name: 'Who are you?' })).toBeInTheDocument();
    await userEvent.type(screen.getByRole('textbox', { name: 'Search people' }), 'grace');
    expect(screen.queryByRole('button', { name: /Ada Lovelace/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Grace Hopper/ }));

    expect(screen.getByTestId('search')).toHaveTextContent('?mine=1');
    await waitFor(() => expect(mrCall(calls)?.url.searchParams.get('mine')).toBe('1'));
    expect(mrCall(calls)?.url.searchParams.get('me')).toBe('u2');
    expect(localStorage.getItem('mrdash.me')).toBe('u2');
  });

  it('sends the remembered person with the attention view without turning Only mine on', async () => {
    localStorage.setItem('mrdash.me', 'u1');
    const { calls } = stubApi(handlers());
    renderWithProviders(<MergeRequestsPage />);
    await screen.findByText('MR a');
    await waitFor(() => expect(mrCall(calls)?.url.searchParams.get('me')).toBe('u1'));
    expect(mrCall(calls)?.url.searchParams.get('mine')).toBeNull();
  });

  it('reveals the fields hidden on narrow screens in an expanded row', async () => {
    stubApi(handlers());
    renderWithProviders(<MergeRequestsPage />);
    await screen.findByText('MR a');
    const toggle = screen.getByRole('button', { name: 'Show details for MR a' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Hide details for MR a' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByText('feat/x → main')).toBeInTheDocument();
    expect(screen.getByText('Repository')).toBeInTheDocument();
  });

  it('flips the Updated sort from the column header', async () => {
    const { calls } = stubApi(handlers());
    renderWithProviders(<MergeRequestsPage />, '/?tab=all');
    await screen.findByText('MR a');
    expect(mrCall(calls)?.url.searchParams.get('sort')).toBe('updatedAt');
    expect(mrCall(calls)?.url.searchParams.get('order')).toBe('desc');
    await userEvent.click(screen.getByRole('button', { name: /Updated/ }));
    await waitFor(() => expect(mrCall(calls)?.url.searchParams.get('order')).toBe('asc'));
    expect(screen.getByRole('columnheader', { name: /Updated/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
  });

  it('shows an empty state with a clear action when filters match nothing', async () => {
    stubApi(handlers({ items: [], nextCursor: null }));
    renderWithProviders(<MergeRequestsPage />, '/?tab=closed&q=zzz');
    expect(await screen.findByText('No merge requests match these filters')).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: 'Clear filters' })[0]!);
    expect(screen.getByTestId('search')).not.toHaveTextContent('q=');
  });

  it('shows an error state with retry', async () => {
    stubApi({ ...handlers(), 'GET /merge-requests': () => new Response('{}', { status: 500 }) });
    renderWithProviders(<MergeRequestsPage />);
    expect(await screen.findByText('Could not load merge requests')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('no longer shows a sync button on the page (sync lives in the top bar)', async () => {
    stubApi(handlers());
    renderWithProviders(<MergeRequestsPage />);
    await screen.findByText('MR a');
    expect(screen.queryByRole('button', { name: 'Sync now' })).not.toBeInTheDocument();
    expect(screen.queryByText(/synced/i)).not.toBeInTheDocument();
  });
});
