import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Profiler, useState } from 'react';
import { TasksTable } from '../TasksTable';
import { makeTask, mockLayout, withBug } from './testUtils';

const tasks = [withBug('a', makeTask('a'), 2), makeTask('b'), withBug('c', makeTask('c'), 1)];

const noop = () => {};
let restore: () => void;
beforeEach(() => (restore = mockLayout()));
afterEach(() => restore());

function Harness({
  onRowRender,
}: {
  onRowRender?: React.ComponentProps<typeof TasksTable>['onRowRender'];
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  return (
    <TasksTable
      tasks={tasks}
      expanded={expanded}
      onExpandedChange={setExpanded}
      selectedId={null}
      onOpen={noop}
      onRowRender={onRowRender}
    />
  );
}

describe('TasksTable', () => {
  it('renders semantic table markup with a sub-bug count pill', () => {
    render(<Harness />);
    expect(screen.getByRole('table', { name: 'Tasks' })).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toContain('Linked MRs');
    const row = screen.getByText('Task a').closest('tr') as HTMLElement;
    expect(within(row).getByText('2')).toBeInTheDocument();
  });

  it('expands and collapses sub-bugs with aria-expanded', async () => {
    render(<Harness />);
    const toggle = screen.getByRole('button', { name: 'Expand Task a' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Bug a-0')).not.toBeInTheDocument();

    await userEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Collapse Task a' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    const sub = screen.getByText('Bug a-0').closest('tr') as HTMLElement;
    expect(sub).toHaveAttribute('aria-level', '2');
    expect(screen.getByText('Bug a-1')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Collapse Task a' }));
    expect(screen.queryByText('Bug a-0')).not.toBeInTheDocument();
  });

  it('re-renders only the toggled row (and mounts its new sub-rows)', async () => {
    const rendered: string[] = [];
    // Defined once: an inline callback would change identity every render and defeat memo().
    const onRowRender = (id: string, phase: string) => void rendered.push(`${id}:${phase}`);
    render(<Harness onRowRender={onRowRender} />);
    rendered.length = 0;

    await userEvent.click(screen.getByRole('button', { name: 'Expand Task a' }));

    // Row "a" updates; its two sub-bugs mount; rows "b" and "c" never render again.
    expect(rendered.filter((r) => r.endsWith(':update')).map((r) => r.split(':')[0])).toEqual([
      'a',
    ]);
    expect(rendered.filter((r) => r.endsWith(':mount')).sort()).toEqual([
      'a-bug0:mount',
      'a-bug1:mount',
    ]);
    expect(rendered.some((r) => r.startsWith('b:') || r.startsWith('c:'))).toBe(false);
  });
});

it('Profiler is wired (sanity)', () => {
  const seen = vi.fn();
  render(
    <Profiler id="x" onRender={seen}>
      <div />
    </Profiler>,
  );
  expect(seen).toHaveBeenCalled();
});
