import type { MergeRequest } from '@mrdash/shared';
import { ChevronRight, ExternalLink } from 'lucide-react';
import { memo } from 'react';
import { useHighlighted } from '../../api/highlights';
import { StatusBadge } from '../../components/data/StatusBadge';
import { cn } from '../../lib/cn';
import { formatDateTime } from '../../lib/datetime';
import { GRID, SHOW } from './columns';
import {
  AuthorCell,
  LinkedTaskCell,
  MrIdCell,
  mrLabel,
  ReasonChips,
  ReviewersCell,
  shortRepoName,
  TargetBranchCell,
  UpdatedCell,
} from './MrCells';

interface Props {
  mr: MergeRequest;
  repoName: string;
  /** Position in the list; the virtualizer uses it to measure expanded rows. */
  index: number;
  expanded: boolean;
  onToggle: (id: string) => void;
  measure?: (el: HTMLElement | null) => void;
}

/** The fields hidden on narrow screens, shown under the row when it is expanded. */
function Details({ mr, repoName }: { mr: MergeRequest; repoName: string }) {
  const field = (label: string, value: React.ReactNode) => (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs text-fg-muted">{label}</dt>
      <dd className="min-w-0 text-xs">{value}</dd>
    </div>
  );
  return (
    <dl className="grid grid-cols-1 gap-3 pb-3 pl-9 sm:grid-cols-2">
      {field('Repository', repoName)}
      {field('Author', <AuthorCell author={mr.author} />)}
      {field('Reviewers', <ReviewersCell reviewers={mr.reviewers} />)}
      {field('Branches', `${mr.sourceBranch} → ${mr.targetBranch}`)}
      {field('Created', formatDateTime(mr.createdAtRemote))}
      {field('Updated', formatDateTime(mr.updatedAtRemote))}
      {field('Linked task', <LinkedTaskCell tasks={mr.tasks} />)}
    </dl>
  );
}

function MrRowView({ mr, repoName, index, expanded, onToggle, measure }: Props) {
  const highlighted = useHighlighted(mr.id);
  return (
    <tr
      role="row"
      ref={measure}
      data-index={index}
      data-row-id={mr.id}
      data-highlighted={highlighted || undefined}
      className={cn(
        'grid min-h-12 items-center gap-x-2 border-b border-border px-3 text-sm hover:bg-raised',
        GRID,
        highlighted && 'animate-[row-flash_3s_ease-out]',
      )}
    >
      <td role="cell" className={SHOW.toggle}>
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={`${expanded ? 'Hide' : 'Show'} details for ${mr.title}`}
          onClick={() => onToggle(mr.id)}
          className="rounded-control p-0.5 text-fg-secondary hover:bg-surface hover:text-fg"
        >
          <ChevronRight
            size={14}
            aria-hidden="true"
            className={cn('transition-transform', expanded && 'rotate-90')}
          />
        </button>
      </td>
      <td role="cell" className={cn('min-w-0', SHOW.mr)}>
        <MrIdCell mr={mr} repoName={repoName} />
      </td>
      <td role="cell" className="min-w-0 py-1">
        <span className="flex min-w-0 items-center gap-2">
          <a
            href={mr.url}
            target="_blank"
            rel="noreferrer"
            title={mr.title}
            className="flex min-w-0 items-center gap-1 text-fg hover:underline"
          >
            <span className="truncate">{mr.title}</span>
            <ExternalLink size={12} aria-hidden="true" className="shrink-0 text-fg-muted" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
          {mr.reasons ? <ReasonChips reasons={mr.reasons} /> : null}
        </span>
        <span className="block truncate text-xs text-fg-muted md:hidden">
          {shortRepoName(repoName)} {mrLabel(mr)}
        </span>
      </td>
      <td role="cell" className={cn('min-w-0', SHOW.author)}>
        <AuthorCell author={mr.author} />
      </td>
      <td role="cell" className={SHOW.reviewers}>
        <ReviewersCell reviewers={mr.reviewers} />
      </td>
      <td role="cell">
        <StatusBadge status={mr.status} />
      </td>
      <td role="cell" className={cn('min-w-0', SHOW.target)}>
        <TargetBranchCell mr={mr} />
      </td>
      <td role="cell" className={SHOW.updated}>
        <UpdatedCell iso={mr.updatedAtRemote} />
      </td>
      <td role="cell" className={cn('min-w-0', SHOW.linked)}>
        <LinkedTaskCell tasks={mr.tasks} />
      </td>
      {expanded ? (
        <td role="cell" className="col-[1/-1] xl:hidden">
          <Details mr={mr} repoName={repoName} />
        </td>
      ) : null}
    </tr>
  );
}

export const MrRow = memo(MrRowView);
