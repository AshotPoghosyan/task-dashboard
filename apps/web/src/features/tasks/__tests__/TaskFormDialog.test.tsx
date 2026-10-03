import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TaskFormDialog } from '../TaskFormDialog';
import { makeTask, renderWithProviders, stubApi } from './testUtils';

afterEach(() => vi.unstubAllGlobals());

describe('TaskFormDialog', () => {
  it('rejects an empty title without calling the API', async () => {
    const { calls } = stubApi({});
    renderWithProviders(<TaskFormDialog open onOpenChange={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Create task' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Title is required');
    expect(screen.getByLabelText('Title')).toHaveAttribute('aria-invalid', 'true');
    expect(calls).toEqual([]);
  });

  it('rejects an over-long title', async () => {
    stubApi({});
    renderWithProviders(<TaskFormDialog open onOpenChange={() => {}} />);
    await userEvent.click(screen.getByLabelText('Title'));
    await userEvent.paste('x'.repeat(501));
    await userEvent.click(screen.getByRole('button', { name: 'Create task' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('creates a task with trimmed, null-able fields and closes', async () => {
    const onOpenChange = vi.fn();
    const { calls } = stubApi({
      'POST /tasks': () => makeTask('new'),
      'GET /tasks': () => ({ items: [], nextCursor: null }),
    });
    renderWithProviders(<TaskFormDialog open onOpenChange={onOpenChange} />);
    await userEvent.type(screen.getByLabelText('Title'), '  Ship it  ');
    await userEvent.click(screen.getByRole('button', { name: 'Create task' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    const post = calls.find((c) => c.init?.method === 'POST');
    expect(JSON.parse(String(post?.init?.body))).toMatchObject({
      title: 'Ship it',
      type: 'TASK',
      assigneeName: null,
      targetBranch: null,
    });
  });

  it('edits an existing task with PATCH', async () => {
    const task = makeTask('t1');
    const { calls } = stubApi({
      'PATCH /tasks/t1': () => task,
      'GET /tasks': () => ({ items: [], nextCursor: null }),
    });
    renderWithProviders(<TaskFormDialog open onOpenChange={() => {}} task={task} />);
    const title = screen.getByLabelText('Title');
    expect(title).toHaveValue('Task t1');
    await userEvent.clear(title);
    await userEvent.type(title, 'Renamed');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(calls.some((c) => c.init?.method === 'PATCH')).toBe(true));
    expect(
      JSON.parse(String(calls.find((c) => c.init?.method === 'PATCH')?.init?.body)).title,
    ).toBe('Renamed');
  });
});
