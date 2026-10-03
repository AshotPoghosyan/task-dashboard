import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockLayout, renderWithProviders, stubApi } from '../../tasks/__tests__/testUtils';
import MergeRequestsPage from '../MergeRequestsPage';
import { makeMr, user } from './mrUtils';

const stats = { openMrs: 10, pendingReviews: 3, mergedToday: 2, draft: 2, closedThisWeek: 4 };
const options = {
  assignees: [],
  branches: ['main'],
  repositories: [{ id: 'r1', provider: 'GITLAB', fullPath: 'acme/web' }],
  users: [user('u1', 'Ada Lovelace'), user('u2', 'Grace Hopper')],
};
const syncStatus = {
  running: false,
  providers: { GITLAB: true, GITHUB: true },
  repositories: [
    {
      repositoryId: 'r1',
      provider: 'GITLAB',
      fullPath: 'acme/web',
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
  restore();
  vi.unstubAllGlobals();
});

const handlers = (list: unknown = { items: [makeMr('a')], nextCursor: null }) => ({
  'GET /merge-requests': () => list,
  'GET /stats': () => stats,
  'GET /filters/options': () => options,
  'GET /sync/status': () => syncStatus,
  'POST /sync': () => ({ queued: 1 }),
});

describe('MergeRequestsPage', () => {
  it('shows skeletons, then rows with every column', async () => {
    stubApi(handlers());
    renderWithProviders(<MergeRequestsPage />);
    expect(screen.getByRole('status', { name: 'Loading merge requests' })).toBeInTheDocument();
    expect(await screen.findByText('MR a')).toBeInTheDocument();
    expect(screen.getByText('acme/web')).toBeInTheDocument();
    expect(screen.getByText('!12')).toBeInTheDocument();
    expect(screen.getByText('feat/x')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ship login' })).toHaveAttribute(
      'href',
      '/?q=Ship%20login',
    );
    expect(screen.getByLabelText('Approved')).toBeInTheDocument();
    expect(screen.getByText('2d ago')).toHaveAttribute('title');
  });

  it('applies a stat card as a status filter in the URL and request, and removes it', async () => {
    const { calls } = stubApi(handlers());
    renderWithProviders(<MergeRequestsPage />);
    await screen.findByText('MR a');

    await userEvent.click(screen.getByRole('button', { name: /In review/ }));
    expect(screen.getByTestId('search')).toHaveTextContent('?status=IN_REVIEW');
    await waitFor(() =>
      expect(
        calls.some(
          (c) => c.path === '/merge-requests' && c.url.searchParams.get('status') === 'IN_REVIEW',
        ),
      ).toBe(true),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Remove filter Status: In review' }));
    expect(screen.queryByRole('list', { name: 'Active filters' })).not.toBeInTheDocument();
  });

  it('sends select filters as API params and shows readable chips', async () => {
    const { calls } = stubApi(handlers());
    renderWithProviders(<MergeRequestsPage />, '/?authorId=u1&provider=GITLAB&q=login');
    await screen.findByText('MR a');
    const chips = screen.getByRole('list', { name: 'Active filters' });
    expect(chips).toHaveTextContent('Author: Ada Lovelace');
    expect(chips).toHaveTextContent('Provider: GitLab');
    const call = calls.find((c) => c.path === '/merge-requests');
    expect(call?.url.searchParams.get('authorId')).toBe('u1');
    expect(call?.url.searchParams.get('provider')).toBe('GITLAB');
    expect(call?.url.searchParams.get('q')).toBe('login');

    await userEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(screen.getByTestId('search')).toHaveTextContent('');
  });

  it('shows an empty state with a clear action when filters match nothing', async () => {
    stubApi(handlers({ items: [], nextCursor: null }));
    renderWithProviders(<MergeRequestsPage />, '/?status=CLOSED');
    expect(await screen.findByText('No merge requests match these filters')).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: 'Clear filters' })[0]!);
    expect(screen.getByTestId('search')).toHaveTextContent('');
  });

  it('shows an error state with retry', async () => {
    stubApi({ ...handlers(), 'GET /merge-requests': () => new Response('{}', { status: 500 }) });
    renderWithProviders(<MergeRequestsPage />);
    expect(await screen.findByText('Could not load merge requests')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('triggers a sync and lists per-repo errors in a popover', async () => {
    const { calls } = stubApi(handlers());
    renderWithProviders(<MergeRequestsPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Sync now' }));
    await waitFor(() => expect(calls.some((c) => c.init?.method === 'POST')).toBe(true));

    await userEvent.click(await screen.findByRole('button', { name: /1 repository failed/ }));
    expect(await screen.findByText('Bad token')).toBeInTheDocument();
  });
});
