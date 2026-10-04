import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '../ui/Toast';
import { SyncIndicator } from './SyncIndicator';

function setup(repositories: unknown[]) {
  const fetchMock = vi.fn(async (_: RequestInfo | URL, init?: RequestInit) =>
    init?.method === 'POST'
      ? new Response(JSON.stringify({ queued: 2 }), { status: 202 })
      : new Response(
          JSON.stringify({
            running: false,
            providers: { GITLAB: true, GITHUB: true },
            repositories,
          }),
          { status: 200 },
        ),
  );
  vi.stubGlobal('fetch', fetchMock);
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ToastProvider>
        <SyncIndicator />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return fetchMock;
}
afterEach(() => vi.unstubAllGlobals());

describe('SyncIndicator', () => {
  it('says "Not synced yet" with a Sync now button when nothing has synced', async () => {
    const fetchMock = setup([]);
    expect(await screen.findByText('Not synced yet')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Sync now' }));
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(true),
    );
  });

  it('shows the last synced time once, and failures in a popover', async () => {
    setup([
      {
        repositoryId: 'r1',
        provider: 'GITLAB',
        fullPath: 'acme/web',
        isActive: true,
        lastSyncedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
        lastRun: {
          id: 's1',
          status: 'FAILED',
          startedAt: new Date().toISOString(),
          finishedAt: null,
          itemsFetched: 0,
          itemsUpserted: 0,
          error: 'Bad token',
        },
      },
    ]);
    expect(await screen.findByText('Synced 5m ago')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /1 failed/ }));
    expect(await screen.findByText('Bad token')).toBeInTheDocument();
  });
});
