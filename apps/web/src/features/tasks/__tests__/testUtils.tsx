import type { Task } from '@mrdash/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { ToastProvider } from '../../../components/ui/Toast';
import { TooltipProvider } from '../../../components/ui/Tooltip';

export function makeTask(id: string, over: Partial<Task> = {}): Task {
  return {
    id,
    title: `Task ${id}`,
    type: 'FEATURE',
    status: 'OPEN',
    statusOverride: null,
    assigneeName: 'Ada Lovelace',
    targetBranch: 'main',
    notes: null,
    parentId: null,
    sortOrder: 0,
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
    mergeRequests: [],
    children: [],
    ...over,
  };
}

export const withBug = (id: string, parent: Task, n: number): Task => ({
  ...parent,
  children: Array.from({ length: n }, (_, i) => {
    const { children, ...rest } = makeTask(`${id}-bug${i}`, {
      type: 'BUG',
      parentId: parent.id,
      title: `Bug ${id}-${i}`,
    });
    void children;
    return rest;
  }),
});

export function LocationProbe() {
  const { search } = useLocation();
  return <output data-testid="search">{search}</output>;
}

/** Renders inside the providers the tasks feature needs. Returns the query client. */
export function renderWithProviders(
  ui: ReactElement,
  route = '/',
): RenderResult & { client: QueryClient } {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const utils = render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <ToastProvider>
          <MemoryRouter initialEntries={[route]}>
            {ui}
            <LocationProbe />
          </MemoryRouter>
        </ToastProvider>
      </TooltipProvider>
    </QueryClientProvider>,
  );
  return { ...utils, client };
}

type Handler = (url: URL, init?: RequestInit) => unknown;

/** Stubs fetch with path-based handlers; unknown paths return 404. */
export function stubApi(handlers: Record<string, Handler>) {
  const calls: { path: string; url: URL; init?: RequestInit }[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost');
    const path = url.pathname.replace(/^\/api/, '');
    calls.push({ path, url, init });
    const key = `${init?.method ?? 'GET'} ${path}`;
    const handler = handlers[key];
    if (!handler) return new Response('{}', { status: 404 });
    const body = handler(url, init);
    if (body instanceof Response) return body;
    return new Response(JSON.stringify(body), { status: 200 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return { calls, fetchMock };
}

/** jsdom has no layout; give scroll containers a size so the virtualizer renders rows. */
export function mockLayout() {
  const proto = HTMLElement.prototype;
  const h = Object.getOwnPropertyDescriptor(proto, 'offsetHeight');
  const w = Object.getOwnPropertyDescriptor(proto, 'offsetWidth');
  Object.defineProperty(proto, 'offsetHeight', { configurable: true, value: 800 });
  Object.defineProperty(proto, 'offsetWidth', { configurable: true, value: 1200 });
  return () => {
    if (h) Object.defineProperty(proto, 'offsetHeight', h);
    if (w) Object.defineProperty(proto, 'offsetWidth', w);
  };
}
