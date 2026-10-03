import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MultiSelect } from './MultiSelect';

const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
];

function Harness() {
  const [value, setValue] = useState<string[]>([]);
  return <MultiSelect label="Letters" options={OPTIONS} value={value} onChange={setValue} />;
}

describe('MultiSelect', () => {
  it('opens with the keyboard, toggles several options and stays open', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    screen.getByRole('button', { name: /Letters/ }).focus();
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('menuitemcheckbox', { name: 'Alpha' })).toBeInTheDocument();

    // Opening with the keyboard focuses the first option.
    await user.keyboard('{Enter}');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(screen.getByRole('menuitemcheckbox', { name: 'Alpha' })).toBeChecked();
    expect(screen.getByRole('menuitemcheckbox', { name: 'Beta' })).toBeChecked();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menuitemcheckbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Letters/ })).toHaveTextContent('2');
  });
});
