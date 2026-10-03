import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeTask, renderWithProviders, stubApi } from '../features/tasks/__tests__/testUtils';
import { useUpdateTask } from './tasks';

afterEach(() => vi.unstubAllGlobals());

function Trigger() {
  const update = useUpdateTask();
  return (
    <button onClick={() => update.mutate({ id: 't1', changes: { statusOverride: 'MERGED' } })}>
      go
    </button>
  );
}

describe('task mutations', () => {
  // Regression: stat cards and filter options went stale after an edit.
  it('invalidates stats and filter options so the stat cards refresh', async () => {
    stubApi({
      'PATCH /tasks/t1': () => makeTask('t1', { status: 'MERGED' }),
      'GET /tasks': () => ({ items: [], nextCursor: null }),
    });
    const { client } = renderWithProviders(<Trigger />);
    client.setQueryData(['stats'], { openMrs: 1, pendingReviews: 0, mergedToday: 0 });
    client.setQueryData(['filter-options'], { assignees: [], targetBranches: [] });

    await userEvent.click(screen.getByRole('button', { name: 'go' }));

    await waitFor(() => expect(client.getQueryState(['stats'])?.isInvalidated).toBe(true));
    expect(client.getQueryState(['filter-options'])?.isInvalidated).toBe(true);
  });
});
