import { act, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import userEvent from '@testing-library/user-event';
import { TaskDrawer } from '../TaskDrawer';
import { NOTES_DEBOUNCE_MS } from '../TaskNotes';
import { makeTask, renderWithProviders, stubApi } from './testUtils';

const noop = () => {};
const user = {
  id: 'u1',
  provider: 'GITLAB' as const,
  externalId: '1',
  username: 'ada',
  displayName: 'Ada',
  avatarUrl: null,
};
const mr = {
  id: 'mr1',
  provider: 'GITLAB' as const,
  number: 12,
  title: 'Fix login',
  status: 'OPEN' as const,
  url: 'https://x/12',
};

afterEach(() => vi.unstubAllGlobals());

const patchBodies = (calls: ReturnType<typeof stubApi>['calls']) =>
  calls.filter((c) => c.init?.method === 'PATCH').map((c) => JSON.parse(String(c.init?.body)));

describe('TaskDrawer', () => {
  it('autosaves notes after the debounce, once', async () => {
    const task = makeTask('t1', { notes: 'old' });
    const { calls } = stubApi({
      'PATCH /tasks/t1': () => ({ ...task, notes: 'new' }),
      'GET /tasks': () => ({ items: [], nextCursor: null }),
    });
    renderWithProviders(<TaskDrawer task={task} onClose={noop} onEdit={noop} onAddSubBug={noop} />);

    const box = screen.getByLabelText('Notes');
    await userEvent.clear(box);
    await userEvent.type(box, 'new');
    expect(patchBodies(calls)).toEqual([]);
    expect(screen.getByRole('status')).toHaveTextContent('Saving');

    await waitFor(() => expect(patchBodies(calls)).toEqual([{ notes: 'new' }]), {
      timeout: NOTES_DEBOUNCE_MS + 2000,
    });
  });

  it('keeps notes retryable after a failed save', async () => {
    const task = makeTask('t1', { notes: null });
    let fail = true;
    const { calls } = stubApi({
      'PATCH /tasks/t1': () =>
        fail
          ? new Response(JSON.stringify({ error: { code: 'X', message: 'nope' } }), { status: 500 })
          : task,
      'GET /tasks': () => ({ items: [], nextCursor: null }),
    });
    let close = () => {};
    function Host() {
      const [open, setOpen] = useState(true);
      close = () => setOpen(false);
      return (
        <TaskDrawer
          task={open ? task : undefined}
          onClose={noop}
          onEdit={noop}
          onAddSubBug={noop}
        />
      );
    }
    renderWithProviders(<Host />);
    await userEvent.type(screen.getByLabelText('Notes'), 'hi');
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Not saved'), {
      timeout: NOTES_DEBOUNCE_MS + 2000,
    });
    fail = false;
    act(() => close());
    await waitFor(() => expect(patchBodies(calls)).toEqual([{ notes: 'hi' }, { notes: 'hi' }]));
  });

  it('flushes pending notes when the drawer closes early', async () => {
    const task = makeTask('t1', { notes: null });
    const { calls } = stubApi({
      'PATCH /tasks/t1': () => task,
      'GET /tasks': () => ({ items: [], nextCursor: null }),
    });
    let close = () => {};
    function Host() {
      const [open, setOpen] = useState(true);
      close = () => setOpen(false);
      return (
        <TaskDrawer
          task={open ? task : undefined}
          onClose={noop}
          onEdit={noop}
          onAddSubBug={noop}
        />
      );
    }
    renderWithProviders(<Host />);
    await userEvent.type(screen.getByLabelText('Notes'), 'hi');
    expect(patchBodies(calls)).toEqual([]);
    act(() => close());
    await waitFor(() => expect(patchBodies(calls)).toEqual([{ notes: 'hi' }]));
  });

  it('sets a status override and rolls back the optimistic change on failure', async () => {
    const task = makeTask('t1');
    stubApi({
      'PATCH /tasks/t1': () =>
        new Response(JSON.stringify({ error: { code: 'X', message: 'nope' } }), { status: 500 }),
    });
    const { client } = renderWithProviders(
      <TaskDrawer task={task} onClose={noop} onEdit={noop} onAddSubBug={noop} />,
    );
    client.setQueryData(['tasks', {}], {
      pages: [{ items: [task], nextCursor: null }],
      pageParams: [undefined],
    });

    await userEvent.click(screen.getByRole('combobox', { name: 'Status override' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Merged' }));

    expect(await screen.findByText('Could not save changes')).toBeInTheDocument();
    const cached = client.getQueryData<{ pages: { items: (typeof task)[] }[] }>(['tasks', {}]);
    expect(cached?.pages[0]?.items[0]?.status).toBe('OPEN');
    expect(cached?.pages[0]?.items[0]?.statusOverride).toBeNull();
  });

  it('links a merge request from the searchable picker and unlinks it', async () => {
    const task = makeTask('t1');
    const linked = { ...task, mergeRequests: [mr] };
    const { calls } = stubApi({
      'GET /merge-requests': () => ({
        items: [
          {
            ...mr,
            repositoryId: 'r',
            externalId: '1',
            description: null,
            isDraft: false,
            sourceBranch: 'f',
            targetBranch: 'main',
            author: user,
            assignee: null,
            reviewers: [],
            createdAtRemote: '2026-10-01T10:00:00.000Z',
            updatedAtRemote: '2026-10-01T10:00:00.000Z',
            mergedAt: null,
            closedAt: null,
          },
        ],
        nextCursor: null,
      }),
      'POST /tasks/t1/merge-requests': () => linked,
      'DELETE /tasks/t1/merge-requests/mr1': () => task,
      'GET /tasks': () => ({ items: [], nextCursor: null }),
    });
    const { client } = renderWithProviders(
      <TaskDrawer task={task} onClose={noop} onEdit={noop} onAddSubBug={noop} />,
    );
    client.setQueryData(['tasks', {}], {
      pages: [{ items: [task], nextCursor: null }],
      pageParams: [undefined],
    });

    await userEvent.click(screen.getByRole('button', { name: 'Link MR' }));
    await userEvent.type(screen.getByLabelText('Search merge requests'), 'login');
    await userEvent.click(await screen.findByRole('button', { name: /Fix login/ }));

    await waitFor(() => expect(calls.some((c) => c.init?.method === 'POST')).toBe(true));
    expect(JSON.parse(String(calls.find((c) => c.init?.method === 'POST')?.init?.body))).toEqual({
      mergeRequestId: 'mr1',
    });
  });
});
