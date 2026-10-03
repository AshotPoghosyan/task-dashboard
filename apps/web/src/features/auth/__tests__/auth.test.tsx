import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ToastProvider } from '../../../components/ui/Toast';
import UsersPage from '../../../pages/UsersPage';
import { LoginPage } from '../LoginPage';
import { AccessDeniedPage, SessionExpiredPage } from '../StatusPages';
import { RequireAuth } from '../RequireAuth';

type Handler = (url: string, init?: RequestInit) => unknown;

const admin = {
  id: 'u1',
  provider: 'GITHUB',
  username: 'ada',
  displayName: 'Ada L',
  avatarUrl: null,
  role: 'ADMIN',
};
const mia = {
  ...admin,
  id: 'u2',
  username: 'mia',
  displayName: 'Mia K',
  role: 'MEMBER',
  email: 'mia@x.io',
  lastLoginAt: '2026-10-01T10:00:00.000Z',
  disabledAt: null,
  createdAt: '2026-09-01T10:00:00.000Z',
};

function stubApi(handler: Handler) {
  const calls: { url: string; init?: RequestInit | undefined }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      const body = handler(url, init);
      return new Response(body === undefined ? null : JSON.stringify(body), {
        status: body === undefined ? 204 : 200,
      });
    }),
  );
  return calls;
}

function renderAt(path: string, ui: React.ReactNode) {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <ToastProvider>
        <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('LoginPage', () => {
  const loggedOut = { required: true, authenticated: false };

  it('shows a button per configured provider and no password form', async () => {
    stubApi((url) =>
      url.includes('/providers')
        ? {
            mode: 'oauth',
            password: false,
            providers: [
              { id: 'GITHUB', name: 'GitHub' },
              { id: 'GITLAB', name: 'GitLab' },
            ],
          }
        : loggedOut,
    );
    const { container } = renderAt('/login', <LoginPage />);
    const gh = await screen.findByRole('link', { name: 'Continue with GitHub' });
    expect(gh).toHaveAttribute('href', '/api/auth/login/github');
    expect(screen.getByRole('link', { name: 'Continue with GitLab' })).toHaveAttribute(
      'href',
      '/api/auth/login/gitlab',
    );
    expect(screen.queryByLabelText('Password')).toBeNull();
    const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(results.violations).toEqual([]);
  });

  it('offers both in both mode', async () => {
    stubApi((url) =>
      url.includes('/providers')
        ? { mode: 'both', password: true, providers: [{ id: 'GITHUB', name: 'GitHub' }] }
        : loggedOut,
    );
    renderAt('/login', <LoginPage />);
    expect(await screen.findByRole('link', { name: 'Continue with GitHub' })).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });

  it('is password-only when no provider is configured', async () => {
    stubApi((url) =>
      url.includes('/providers') ? { mode: 'password', password: true, providers: [] } : loggedOut,
    );
    renderAt('/login', <LoginPage />);
    expect(await screen.findByLabelText('Password')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Continue with/ })).toBeNull();
  });

  it('explains a failed provider callback', async () => {
    stubApi((url) =>
      url.includes('/providers') ? { mode: 'oauth', password: false, providers: [] } : loggedOut,
    );
    renderAt('/login?error=state', <LoginPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/expired/);
  });
});

describe('status pages', () => {
  it('access denied tells people who to ask', () => {
    renderAt('/', <AccessDeniedPage />);
    expect(screen.getByRole('heading', { name: 'Access denied' })).toBeInTheDocument();
    expect(screen.getByText(/Ask a dashboard admin/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute('href', '/login');
  });

  it('session expired offers a way back', () => {
    renderAt('/', <SessionExpiredPage />);
    expect(screen.getByRole('heading', { name: 'Your session has ended' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in again' })).toBeInTheDocument();
  });
});

describe('RequireAuth', () => {
  it('shows the user menu with a sign-out action', async () => {
    const calls = stubApi((url, init) => {
      if (url.includes('/auth/session'))
        return { required: true, authenticated: true, user: admin };
      if (url.includes('/auth/logout') && init?.method === 'POST') return undefined;
      return { running: false, providers: { GITLAB: true, GITHUB: true }, repositories: [] };
    });
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    renderAt(
      '/',
      <Routes>
        <Route element={<RequireAuth />}>
          <Route index element={<h1>Home</h1>} />
        </Route>
      </Routes>,
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Account menu for Ada L' }));
    expect(screen.getByText(/@ada · GitHub · Admin/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith('/login'));
    expect(calls.some((c) => c.url.includes('/auth/logout'))).toBe(true);
  });

  it('shows Users in the navigation for admins only', async () => {
    stubApi((url) =>
      url.includes('/auth/session')
        ? { required: true, authenticated: true, user: { ...admin, role: 'MEMBER' } }
        : { running: false, providers: { GITLAB: true, GITHUB: true }, repositories: [] },
    );
    renderAt(
      '/',
      <Routes>
        <Route element={<RequireAuth />}>
          <Route index element={<h1>Home</h1>} />
        </Route>
      </Routes>,
    );
    await screen.findByRole('heading', { name: 'Home' });
    expect(screen.queryByRole('link', { name: 'Users' })).toBeNull();
  });
});

describe('UsersPage', () => {
  it('is closed to members', async () => {
    stubApi(() => ({ required: true, authenticated: true, user: { ...admin, role: 'MEMBER' } }));
    renderAt('/settings/users', <UsersPage />);
    expect(await screen.findByText('Admins only')).toBeInTheDocument();
  });

  it('lists users and disables one only after confirmation', async () => {
    const calls = stubApi((url, init) => {
      if (url.includes('/auth/session'))
        return { required: true, authenticated: true, user: admin };
      if (init?.method === 'PATCH') return { ...mia, disabledAt: '2026-10-03T10:00:00.000Z' };
      return {
        items: [
          { ...admin, email: null, lastLoginAt: null, disabledAt: null, createdAt: mia.createdAt },
          mia,
        ],
      };
    });
    const { container } = renderAt('/settings/users', <UsersPage />);
    expect(await screen.findByText('@mia · mia@x.io')).toBeInTheDocument();
    expect(screen.getByText('Never')).toBeInTheDocument();
    const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(results.violations).toEqual([]);

    await userEvent.click(screen.getByRole('button', { name: 'Disable Mia K' }));
    expect(await screen.findByText('Disable Mia K?')).toBeInTheDocument();
    expect(calls.some((c) => c.init?.method === 'PATCH')).toBe(false);

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(calls.some((c) => c.init?.method === 'PATCH')).toBe(false);

    await userEvent.click(screen.getByRole('button', { name: 'Disable Mia K' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Disable' }));
    await waitFor(() => {
      const patch = calls.find((c) => c.init?.method === 'PATCH');
      expect(patch?.url).toBe('/api/users/u2');
      expect(patch?.init?.body).toBe(JSON.stringify({ disabled: true }));
    });
  });

  it('reports a failed update with an error toast', async () => {
    stubApi((url, init) => {
      if (url.includes('/auth/session'))
        return { required: true, authenticated: true, user: admin };
      if (init?.method === 'PATCH') return undefined;
      return {
        items: [
          { ...admin, email: null, lastLoginAt: null, disabledAt: null, createdAt: mia.createdAt },
        ],
      };
    });
    renderAt('/settings/users', <UsersPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Disable Ada L' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Disable' }));
    // A 204 body fails response validation, which surfaces as an error toast.
    expect(await screen.findByText('Could not update user')).toBeInTheDocument();
  });
});
