import { fireEvent, render, screen } from '@testing-library/react';
import { Avatar, AvatarStack } from './Avatar';

describe('Avatar', () => {
  it('shows the picture when there is a URL', () => {
    render(<Avatar name="Ada Lovelace" avatarUrl="https://example.com/a.png" />);
    const avatar = screen.getByRole('img', { name: 'Ada Lovelace' });
    expect(avatar.querySelector('img')).toHaveAttribute('src', 'https://example.com/a.png');
    expect(avatar).not.toHaveTextContent('AL');
  });

  it('shows initials on a colored circle when the URL is missing', () => {
    render(<Avatar name="Ada Lovelace" avatarUrl={null} />);
    const circle = screen.getByRole('img', { name: 'Ada Lovelace' });
    expect(circle).toHaveTextContent('AL');
    expect(circle.className).toMatch(/bg-avatar-\d/);
  });

  it('falls back to initials when the image fails to load or is blocked', () => {
    render(<Avatar name="Grace Hopper" avatarUrl="https://blocked.example/a.png" />);
    fireEvent.error(screen.getByRole('img', { name: 'Grace Hopper' }).querySelector('img')!);
    const circle = screen.getByRole('img', { name: 'Grace Hopper' });
    expect(circle.querySelector('img')).toBeNull();
    expect(circle).toHaveTextContent('GH');
  });

  it('never renders the alt text as visible text', () => {
    const { container } = render(
      <Avatar name="Grace Hopper" avatarUrl="https://x.example/a.png" />,
    );
    expect(container.querySelector('img')).toHaveAttribute('alt', '');
    expect(container).not.toHaveTextContent('Grace Hopper');
    fireEvent.error(container.querySelector('img')!);
    expect(container).not.toHaveTextContent('Grace Hopper');
  });

  it('tries again when the URL changes after a failure', () => {
    const { rerender } = render(<Avatar name="Ada" avatarUrl="https://x.example/bad.png" />);
    fireEvent.error(screen.getByRole('img', { name: 'Ada' }).querySelector('img')!);
    expect(screen.getByRole('img', { name: 'Ada' }).querySelector('img')).toBeNull();
    rerender(<Avatar name="Ada" avatarUrl="https://x.example/good.png" />);
    expect(screen.getByRole('img', { name: 'Ada' }).querySelector('img')).not.toBeNull();
  });

  it('stacks people and counts the rest', () => {
    render(<AvatarStack people={['A', 'B', 'C', 'D', 'E'].map((name) => ({ name }))} max={3} />);
    expect(screen.getAllByRole('img')).toHaveLength(3);
    expect(screen.getByText('+2')).toBeInTheDocument();
  });
});
