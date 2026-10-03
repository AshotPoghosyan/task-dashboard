import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TasksPage from '../TasksPage';
import { makeTask, mockLayout, renderWithProviders, stubApi, withBug } from './testUtils';

const items = [withBug('a', makeTask('a'), 2), makeTask('b')];
const stats = { openMrs: 7, pendingReviews: 3, mergedToday: 2, draft: 1, closedThisWeek: 0 };
const options = { assignees: ['Ada Lovelace'], branches: ['main'], repositories: [], users: [] };

let restore: () => void;
beforeEach(() => (restore = mockLayout()));
afterEach(() => {
  restore();
  vi.unstubAllGlobals();
});

const handlers = (list: unknown = { items, nextCursor: null }) => ({
  'GET /tasks': () => list,
  'GET /stats': () => stats,
  'GET /filters/options': () => options,
});

describe('TasksPage', () => {
  it('shows skeletons, then rows', async () => {
    stubApi(handlers());
    renderWithProviders(<TasksPage />);
    expect(screen.getByRole('status', { name: 'Loading tasks' })).toBeInTheDocument();
    expect(await screen.findByText('Task a')).toBeInTheDocument();
    expect(await screen.findByText('7')).toBeInTheDocument();
  });

  it('syncs a stat-card filter to the URL and the request, and toggles it off', async () => {
    const { calls } = stubApi(handlers());
    renderWithProviders(<TasksPage />);
    await screen.findByText('Task a');

    await userEvent.click(screen.getByRole('button', { name: /Pending Reviews/ }));
    expect(screen.getByTestId('search')).toHaveTextContent('?status=IN_REVIEW');
    await waitFor(() =>
      expect(
        calls.some((c) => c.path === '/tasks' && c.url.searchParams.get('status') === 'IN_REVIEW'),
      ).toBe(true),
    );
    expect(screen.getByRole('list', { name: 'Active filters' })).toHaveTextContent('In review');

    await userEvent.click(screen.getByRole('button', { name: 'Remove filter Status: In review' }));
    expect(screen.getByTestId('search')).toHaveTextContent('');
    expect(screen.queryByRole('list', { name: 'Active filters' })).not.toBeInTheDocument();
  });

  it('reads filters from the URL and clears them all', async () => {
    stubApi(handlers());
    renderWithProviders(<TasksPage />, '/?status=OPEN,DRAFT&q=login');
    await screen.findByText('Task a');
    const chips = screen.getByRole('list', { name: 'Active filters' });
    expect(chips).toHaveTextContent('Search:');
    expect(chips).toHaveTextContent('Open');
    expect(chips).toHaveTextContent('Draft');
    await userEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(screen.getByTestId('search')).toHaveTextContent('');
  });

  it('shows an empty state with a clear-filters action', async () => {
    stubApi(handlers({ items: [], nextCursor: null }));
    renderWithProviders(<TasksPage />, '/?type=BUG');
    expect(await screen.findByText('No tasks match these filters')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByTestId('search')).toHaveTextContent('');
  });

  it('shows an error state and retries', async () => {
    let fail = true;
    stubApi({
      ...handlers(),
      'GET /tasks': () =>
        fail
          ? new Response(JSON.stringify({ error: { code: 'X', message: 'boom' } }), { status: 500 })
          : { items, nextCursor: null },
    });
    renderWithProviders(<TasksPage />);
    expect(await screen.findByText('boom')).toBeInTheDocument();
    fail = false;
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Task a')).toBeInTheDocument();
  });

  it('supports j/k/Enter/e keyboard navigation and Esc to close the drawer', async () => {
    stubApi(handlers());
    renderWithProviders(<TasksPage />);
    await screen.findByText('Task a');

    await userEvent.keyboard('j');
    expect(screen.getByText('Task a').closest('tr')).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('e');
    expect(await screen.findByText('Bug a-0')).toBeInTheDocument();
    await userEvent.keyboard('j');
    expect(screen.getByText('Bug a-0').closest('tr')).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('k');
    expect(screen.getByText('Task a').closest('tr')).toHaveAttribute('aria-selected', 'true');

    await userEvent.keyboard('{Enter}');
    expect(await screen.findByRole('dialog', { name: 'Task a' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('expands and collapses all rows', async () => {
    stubApi(handlers());
    renderWithProviders(<TasksPage />);
    await screen.findByText('Task a');
    await userEvent.click(screen.getByRole('button', { name: 'Expand all' }));
    expect(screen.getByText('Bug a-1')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Collapse all' }));
    expect(screen.queryByText('Bug a-1')).not.toBeInTheDocument();
  });
});
