import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppShell } from './AppShell';

const status = { running: false, providers: { GITLAB: true, GITHUB: true }, repositories: [] };

function renderShell() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(status), { status: 200 })),
  );
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <Routes>
          <Route element={<AppShell showLogout />}>
            <Route index element={<h1>Page</h1>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('AppShell', () => {
  it('has no axe violations', async () => {
    const { container } = renderShell();
    await screen.findByText(/Synced|Never synced/);
    // jsdom cannot compute layout colors, so contrast is checked by token choice, not here.
    const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(results.violations).toEqual([]);
  });

  it('collapses the sidebar and keeps nav labels accessible', async () => {
    renderShell();
    const toggle = screen.getByRole('button', { name: 'Collapse sidebar' });
    await userEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.getByRole('link', { name: 'Tasks' })).toBeInTheDocument();
  });

  it('focuses the search box with /', async () => {
    renderShell();
    await userEvent.keyboard('/');
    expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveFocus();
  });
});
