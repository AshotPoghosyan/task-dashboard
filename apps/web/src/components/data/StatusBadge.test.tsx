import { TASK_STATUSES } from '@mrdash/shared';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
  it.each(TASK_STATUSES)('shows a label and an icon for %s', (status) => {
    const { container } = render(<StatusBadge status={status} />);
    expect(screen.getByText(/\w/)).toBeInTheDocument();
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(container.firstElementChild).toHaveAttribute('data-status', status);
  });

  it('uses the human label from the shared display map', () => {
    render(<StatusBadge status="IN_REVIEW" />);
    expect(screen.getByText('In review')).toBeInTheDocument();
  });
});
