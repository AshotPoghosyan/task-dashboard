import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { THEME_KEY } from '../../lib/theme';
import { AccountMenu } from './AccountMenu';

const options = {
  assignees: [],
  branches: [],
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

function renderMenu(props: React.ComponentProps<typeof AccountMenu>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const body = String(input).includes('/filters/options') ? options : {};
      return new Response(JSON.stringify(body), { status: 200 });
    }),
  );
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <AccountMenu {...props} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('matchMedia', () => ({
    matches: true,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe('AccountMenu', () => {
  it('offers System, Light and Dark, with System selected by default', async () => {
    renderMenu({ showLogout: false });
    await userEvent.click(screen.getByRole('button', { name: /Account menu/ }));
    const group = await screen.findByRole('radiogroup', { name: 'Theme' });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'System' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Light' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Dark' })).toBeInTheDocument();
  });

  it('switches the theme, saves it and applies it right away', async () => {
    renderMenu({ showLogout: false });
    await userEvent.click(screen.getByRole('button', { name: /Account menu/ }));
    await userEvent.click(await screen.findByRole('radio', { name: 'Light' }));
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem(THEME_KEY)).toBe('light');
    expect(screen.getByRole('radio', { name: 'Light' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('lets a shared-password user pick and change who they are', async () => {
    renderMenu({ showLogout: true });
    await userEvent.click(screen.getByRole('button', { name: /Account menu/ }));
    expect(await screen.findByText('Nobody picked yet')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Pick' }));
    await userEvent.click(await screen.findByRole('button', { name: /Ada Lovelace/ }));
    expect(localStorage.getItem('mrdash.me')).toBe('u1');
    // Picking closes the menu; open it again to see the saved choice.
    await userEvent.click(screen.getByRole('button', { name: /Account menu for Ada Lovelace/ }));
    expect(await screen.findByText('Viewing as')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });
});
