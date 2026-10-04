import { attentionLabel, type AttentionReason, type MergeRequest } from '@mrdash/shared';
import { Check, Circle, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Avatar } from '../../components/data/Avatar';
import { ProviderIcon } from '../../components/data/ProviderIcon';
import { Tooltip } from '../../components/ui/Tooltip';
import { cn } from '../../lib/cn';
import { formatDateTime, relativeAge } from '../../lib/datetime';

export const mrLabel = (m: Pick<MergeRequest, 'provider' | 'number'>) =>
  `${m.provider === 'GITLAB' ? '!' : '#'}${m.number}`;

/** `acme/group/backend` → `backend`. */
export const shortRepoName = (fullPath: string) => fullPath.split('/').at(-1) || fullPath;

/** Provider icon + short repo name + number, e.g. `backend !23`; the full path is the tooltip. */
export function MrIdCell({ mr, repoName }: { mr: MergeRequest; repoName: string }) {
  return (
    <Tooltip content={repoName}>
      <span tabIndex={0} className="flex min-w-0 items-center gap-1.5 text-xs text-fg-secondary">
        <ProviderIcon provider={mr.provider} size={14} />
        <span className="tabular truncate font-mono">
          {shortRepoName(repoName)} {mrLabel(mr)}
        </span>
      </span>
    </Tooltip>
  );
}

const STATE_LABEL = {
  REQUESTED: 'Waiting',
  APPROVED: 'Approved',
  CHANGES_REQUESTED: 'Changes requested',
} as const;

const MARK = {
  APPROVED: { Icon: Check, cls: 'bg-success text-accent-fg' },
  CHANGES_REQUESTED: { Icon: X, cls: 'bg-danger text-accent-fg' },
  REQUESTED: { Icon: Circle, cls: 'bg-raised text-fg-secondary border border-border' },
} as const;

/** Avatars with a state mark (✓ approved, ✗ changes requested, ○ waiting) and a tooltip with names. */
export function ReviewersCell({
  reviewers,
  max = 3,
}: Pick<MergeRequest, 'reviewers'> & { max?: number }) {
  if (reviewers.length === 0) return <span className="text-fg-muted">No reviewer</span>;
  const shown = reviewers.slice(0, max);
  const extra = reviewers.length - shown.length;
  return (
    <Tooltip
      content={
        <ul className="flex flex-col gap-0.5">
          {reviewers.map(({ user, state }) => (
            <li key={user.id}>
              {user.displayName}: {STATE_LABEL[state]}
            </li>
          ))}
        </ul>
      }
    >
      <ul tabIndex={0} aria-label="Reviewers" className="flex items-center">
        {shown.map(({ user, state }) => {
          const { Icon, cls } = MARK[state];
          return (
            <li key={user.id} className="relative -ml-1.5 first:ml-0">
              <Avatar name={user.displayName} avatarUrl={user.avatarUrl} size={22} />
              <span
                className={cn(
                  'absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full',
                  cls,
                )}
              >
                <Icon size={9} strokeWidth={3} aria-label={STATE_LABEL[state]} />
              </span>
            </li>
          );
        })}
        {extra > 0 ? <li className="tabular ml-1 text-xs text-fg-secondary">+{extra}</li> : null}
      </ul>
    </Tooltip>
  );
}

export function AuthorCell({ author }: Pick<MergeRequest, 'author'>) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Avatar name={author.displayName} avatarUrl={author.avatarUrl} size={20} />
      <span className="truncate">{author.displayName}</span>
    </span>
  );
}

/** Relative age of the last update; the full date is the tooltip. */
export function UpdatedCell({ iso }: { iso: string }) {
  return (
    <time dateTime={iso} title={formatDateTime(iso)} className="tabular text-xs text-fg-secondary">
      {relativeAge(iso)}
    </time>
  );
}

export function TargetBranchCell({ mr }: { mr: MergeRequest }) {
  return (
    <span
      title={`${mr.sourceBranch} → ${mr.targetBranch}`}
      className="block truncate font-mono text-xs text-fg-secondary"
    >
      {mr.targetBranch}
    </span>
  );
}

export function LinkedTaskCell({ tasks }: Pick<MergeRequest, 'tasks'>) {
  const task = tasks[0];
  if (!task) return <span className="text-fg-muted">–</span>;
  return (
    <Link
      to={`/?q=${encodeURIComponent(task.title)}`}
      title={task.title}
      className="block truncate text-xs text-accent hover:underline"
    >
      {task.title}
      {tasks.length > 1 ? ` +${tasks.length - 1}` : ''}
    </Link>
  );
}

const REASON_TONE: Record<AttentionReason['kind'], string> = {
  REVIEW_REQUESTED: 'border-accent/40 text-accent',
  CHANGES_REQUESTED: 'border-danger/40 text-danger',
  NO_REVIEWER: 'border-status-in-review/40 text-status-in-review',
  STALE: 'border-border text-fg-secondary',
};

export function ReasonChips({ reasons }: { reasons: AttentionReason[] }) {
  return (
    <>
      {reasons.map((r) => (
        <span
          key={r.kind}
          className={cn(
            'shrink-0 rounded-control border bg-surface px-1.5 py-0.5 text-xs font-medium',
            REASON_TONE[r.kind],
          )}
        >
          {attentionLabel(r)}
        </span>
      ))}
    </>
  );
}
