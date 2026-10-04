import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TasksPage from '../TasksPage';
import { makeTask, mockLayout, renderWithProviders, stubApi, withBug } from './testUtils';

const items = [withBug('a', makeTask('a'), 2), makeTask('b')];
const stats = { openMrs: 7, pendingReviews: 3, mergedToday: 2, draft: 1, closedThisWeek: 0 };
const counts = { all: 5, open: 2, inReview: 1, draft: 0, merged: 1, closed: 0, noMr: 1 };
const options = {
  assignees: ['Ada Lovelace'],
  branches: ['main'],
  repositories: [],
  users: [
    {
      id: 'u1',
      provider: 'GITLAB',
      externalId: '1',
      username: 'ada',
      displayName: 'Ada Lovelace',
      avatarUrl: null,
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

const handlers = (list: unknown = { items, nextCursor: null }) => ({
  'GET /tasks': () => list,
  'GET /tasks/counts': () => counts,
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

  it('shows the seven status tabs with counts, All first', async () => {
    stubApi(handlers());
    renderWithProviders(<TasksPage />);
    await screen.findByText('Task a');
    const tabs = within(screen.getByRole('tablist', { name: 'Task status' })).getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual([
      'All5',
      'Open2',
      'In review1',
      'Draft0',
      'Merged1',
      'Closed0',
      'No MR1',
    ]);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('keeps the selected tab in the URL and the request, and goes back to All', async () => {
    const { calls } = stubApi(handlers());
    renderWithProviders(<TasksPage />);
    await screen.findByText('Task a');

    await userEvent.click(screen.getByRole('tab', { name: /No MR/ }));
    expect(screen.getByTestId('search')).toHaveTextContent('?tab=no-mr');
    await waitFor(() =>
      expect(
        calls.some((c) => c.path === '/tasks' && c.url.searchParams.get('status') === 'NO_MR'),
      ).toBe(true),
    );
    expect(screen.getByRole('tab', { name: /No MR/ })).toHaveAttribute('aria-selected', 'true');

    await userEvent.click(screen.getByRole('tab', { name: /^All/ }));
    expect(screen.getByTestId('search')).toHaveTextContent('');
  });

  it('only keeps three stat cards, and a card applies its tab', async () => {
    stubApi(handlers());
    renderWithProviders(<TasksPage />);
    await screen.findByText('Task a');
    const cards = within(screen.getByRole('region', { name: 'Statistics' })).getAllByRole('button');
    expect(cards.map((c) => c.textContent)).toEqual([
      'Open MRs7',
      'Pending reviews3',
      'Merged today2',
    ]);
    await userEvent.click(cards[1]!);
    expect(screen.getByTestId('search')).toHaveTextContent('?tab=in-review');
    expect(screen.getByRole('tab', { name: /In review/ })).toHaveAttribute('aria-selected', 'true');
    await userEvent.click(screen.getByRole('button', { name: /Pending reviews/ }));
    expect(screen.getByTestId('search')).toHaveTextContent('');
  });

  it('sorts by Updated, newest first, and lets the header flip it', async () => {
    const { calls } = stubApi(handlers());
    renderWithProviders(<TasksPage />);
    await screen.findByText('Task a');
    const first = calls.find((c) => c.path === '/tasks');
    expect(first?.url.searchParams.get('sort')).toBe('updatedAt');
    expect(first?.url.searchParams.get('order')).toBe('desc');
    expect(screen.getByRole('columnheader', { name: /Updated/ })).toHaveAttribute(
      'aria-sort',
      'descending',
    );

    await userEvent.click(screen.getByRole('button', { name: /Updated/ }));
    expect(screen.getByTestId('search')).toHaveTextContent('?order=asc');
    await waitFor(() =>
      expect(
        calls.some((c) => c.path === '/tasks' && c.url.searchParams.get('order') === 'asc'),
      ).toBe(true),
    );
  });

  it('puts secondary filters behind More filters and shows them as removable chips', async () => {
    const { calls } = stubApi(handlers());
    renderWithProviders(<TasksPage />, '/?type=BUG&assignee=Ada%20Lovelace&q=login');
    await screen.findByText('Task a');
    expect(screen.getByRole('button', { name: /More filters/ })).toHaveTextContent('2');
    const chips = screen.getByRole('list', { name: 'Active filters' });
    expect(chips).toHaveTextContent('Search: login');
    expect(chips).toHaveTextContent('Type: Bug');
    expect(chips).toHaveTextContent('Assignee: Ada Lovelace');
    const call = calls.find((c) => c.path === '/tasks');
    expect(call?.url.searchParams.get('type')).toBe('BUG');
    expect(call?.url.searchParams.get('assignee')).toBe('Ada Lovelace');

    await userEvent.click(screen.getByRole('button', { name: 'Remove filter Type: Bug' }));
    expect(screen.getByTestId('search')).not.toHaveTextContent('type=');
    await userEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(screen.getByTestId('search')).toHaveTextContent('');
  });

  it('asks who you are before applying Only mine, then filters by that person', async () => {
    const { calls } = stubApi(handlers());
    renderWithProviders(<TasksPage />);
    await screen.findByText('Task a');

    await userEvent.click(screen.getByRole('button', { name: 'Only mine' }));
    await userEvent.click(await screen.findByRole('button', { name: /Ada Lovelace/ }));
    expect(screen.getByTestId('search')).toHaveTextContent('?mine=1');
    expect(screen.getByRole('button', { name: 'Only mine' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await waitFor(() =>
      expect(
        calls.some(
          (c) =>
            c.path === '/tasks' &&
            c.url.searchParams.get('mine') === '1' &&
            c.url.searchParams.get('me') === 'u1',
        ),
      ).toBe(true),
    );
    // The choice is remembered: switching it off and on again does not ask a second time.
    await userEvent.click(screen.getByRole('button', { name: 'Only mine' }));
    await userEvent.click(screen.getByRole('button', { name: 'Only mine' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows an empty state that offers all tasks again', async () => {
    stubApi(handlers({ items: [], nextCursor: null }));
    renderWithProviders(<TasksPage />, '/?tab=closed');
    expect(await screen.findByText('No tasks match these filters')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Show all tasks' }));
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
