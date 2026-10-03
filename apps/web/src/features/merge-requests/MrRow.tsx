import type { MergeRequest } from '@mrdash/shared';
import { ArrowRight, ExternalLink } from 'lucide-react';
import { memo } from 'react';
import { Link } from 'react-router-dom';
import { useHighlighted } from '../../api/highlights';
import { Avatar } from '../../components/data/Avatar';
import { ProviderIcon } from '../../components/data/ProviderIcon';
import { StatusBadge } from '../../components/data/StatusBadge';
import { cn } from '../../lib/cn';
import { formatDateTime, relativeAge } from '../../lib/datetime';
import { GRID, LOW, ROW_HEIGHT } from './columns';
import { ReviewerStack } from './ReviewerStack';

interface Props {
  mr: MergeRequest;
  repoName: string;
}

export const mrLabel = (m: Pick<MergeRequest, 'provider' | 'number'>) =>
  `${m.provider === 'GITLAB' ? '!' : '#'}${m.number}`;

function MrRowView({ mr, repoName }: Props) {
  const highlighted = useHighlighted(mr.id);
  const task = mr.tasks[0];
  return (
    <tr
      role="row"
      data-row-id={mr.id}
      data-highlighted={highlighted || undefined}
      style={{ height: ROW_HEIGHT }}
      className={cn(
        'grid items-center gap-3 border-b border-border px-3 text-sm hover:bg-raised',
        GRID,
        highlighted && 'animate-[row-flash_3s_ease-out]',
      )}
    >
      <td role="cell">
        <ProviderIcon provider={mr.provider} />
      </td>
      <td
        role="cell"
        className={cn('min-w-0 truncate text-xs text-fg-secondary', LOW)}
        title={repoName}
      >
        {repoName}
      </td>
      <td role="cell" className={cn('tabular font-mono text-xs text-fg-secondary', LOW)}>
        {mrLabel(mr)}
      </td>
      <td role="cell" className="min-w-0">
        <a
          href={mr.url}
          target="_blank"
          rel="noreferrer"
          className="flex min-w-0 items-center gap-1 text-fg hover:underline"
        >
          <span className="truncate">{mr.title}</span>
          <ExternalLink size={12} aria-hidden="true" className="shrink-0 text-fg-muted" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      </td>
      <td role="cell" className={cn('min-w-0', LOW)}>
        <span className="flex items-center gap-2">
          <Avatar name={mr.author.displayName} avatarUrl={mr.author.avatarUrl} size={20} />
          <span className="truncate">{mr.author.displayName}</span>
        </span>
      </td>
      <td role="cell" className={LOW}>
        <ReviewerStack reviewers={mr.reviewers} />
      </td>
      <td role="cell">
        <StatusBadge status={mr.status} />
      </td>
      <td role="cell" className={cn('min-w-0 font-mono text-xs', LOW)}>
        <span className="flex items-center gap-1" title={`${mr.sourceBranch} → ${mr.targetBranch}`}>
          <span className="truncate">{mr.sourceBranch}</span>
          <ArrowRight size={10} aria-label="into" className="shrink-0 text-fg-muted" />
          <span className="truncate text-fg-secondary">{mr.targetBranch}</span>
        </span>
      </td>
      <td role="cell" className={cn('tabular text-xs text-fg-secondary', LOW)}>
        <time dateTime={mr.createdAtRemote} title={formatDateTime(mr.createdAtRemote)}>
          {relativeAge(mr.createdAtRemote)}
        </time>
      </td>
      <td role="cell" className={cn('min-w-0 truncate text-xs', LOW)}>
        {task ? (
          <Link
            to={`/?q=${encodeURIComponent(task.title)}`}
            title={task.title}
            className="text-accent hover:underline"
          >
            {task.title}
            {mr.tasks.length > 1 ? ` +${mr.tasks.length - 1}` : ''}
          </Link>
        ) : (
          <span className="text-fg-muted">–</span>
        )}
      </td>
    </tr>
  );
}

export const MrRow = memo(MrRowView);
