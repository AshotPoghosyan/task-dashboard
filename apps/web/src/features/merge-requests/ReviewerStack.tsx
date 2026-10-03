import type { Reviewer } from '@mrdash/shared';
import { Check, MessageSquareWarning } from 'lucide-react';
import { Avatar } from '../../components/data/Avatar';

const STATE_LABEL = {
  REQUESTED: 'Review requested',
  APPROVED: 'Approved',
  CHANGES_REQUESTED: 'Changes requested',
};

/** Overlapping avatars; a badge marks approvals and requested changes (never color alone). */
export function ReviewerStack({ reviewers, max = 3 }: { reviewers: Reviewer[]; max?: number }) {
  if (reviewers.length === 0) return <span className="text-fg-muted">–</span>;
  const shown = reviewers.slice(0, max);
  const extra = reviewers.length - shown.length;
  return (
    <ul className="flex items-center" aria-label="Reviewers">
      {shown.map(({ user, state }) => (
        <li
          key={user.id}
          title={`${user.displayName}: ${STATE_LABEL[state]}`}
          className="relative -ml-1.5 first:ml-0"
        >
          <Avatar name={user.displayName} avatarUrl={user.avatarUrl} size={22} />
          {state === 'APPROVED' ? (
            <Check
              size={10}
              aria-label="Approved"
              className="absolute -bottom-1 -right-1 rounded-full bg-success p-px text-accent-fg"
            />
          ) : null}
          {state === 'CHANGES_REQUESTED' ? (
            <MessageSquareWarning
              size={10}
              aria-label="Changes requested"
              className="absolute -bottom-1 -right-1 rounded-full bg-danger p-px text-accent-fg"
            />
          ) : null}
        </li>
      ))}
      {extra > 0 ? <li className="tabular ml-1 text-xs text-fg-secondary">+{extra}</li> : null}
    </ul>
  );
}
