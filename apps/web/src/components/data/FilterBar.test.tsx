import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilterBar } from './FilterBar';

const chips = [
  { key: 'status', label: 'Status', value: 'Open' },
  { key: 'branch', label: 'Branch', value: 'main' },
];

describe('FilterBar', () => {
  it('renders no chip list without filters', () => {
    render(<FilterBar chips={[]} onRemove={() => {}} onClearAll={() => {}} />);
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('removes a single chip with its labelled button', async () => {
    const onRemove = vi.fn();
    render(<FilterBar chips={chips} onRemove={onRemove} onClearAll={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove filter Branch: main' }));
    expect(onRemove).toHaveBeenCalledWith(chips[1]);
  });

  it('clears all via keyboard', async () => {
    const onClearAll = vi.fn();
    render(<FilterBar chips={chips} onRemove={() => {}} onClearAll={onClearAll} />);
    screen.getByRole('button', { name: 'Clear all' }).focus();
    await userEvent.keyboard('{Enter}');
    expect(onClearAll).toHaveBeenCalledOnce();
  });
});
