import type { MergeRequestSummary } from '@mrdash/shared';
import { Link2 } from 'lucide-react';
import { useState } from 'react';
import { useMergeRequestSearch } from '../../api/tasks';
import { StatusBadge } from '../../components/data/StatusBadge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/Popover';
import { useDebounce } from '../../hooks/useDebounce';

interface Props {
  linkedIds: string[];
  onPick: (mr: MergeRequestSummary) => void;
}

/** Searchable popover listing merge requests that are not yet linked. */
export function MrPicker({ linkedIds, onPick }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const q = useDebounce(text.trim(), 250);
  const { data, isError, isFetching } = useMergeRequestSearch(q, open);
  const items = (data?.items ?? []).filter((m) => !linkedIds.includes(m.id));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm">
          <Link2 size={14} aria-hidden="true" /> Link MR
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <Input
          aria-label="Search merge requests"
          placeholder="Search merge requests…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
        />
        <ul aria-label="Merge requests" className="mt-2 max-h-64 overflow-y-auto">
          {items.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => {
                  onPick({
                    id: m.id,
                    provider: m.provider,
                    number: m.number,
                    title: m.title,
                    status: m.status,
                    url: m.url,
                  });
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between gap-2 rounded-control px-2 py-1.5 text-left hover:bg-surface"
              >
                <span className="min-w-0 truncate">
                  <span className="tabular text-fg-secondary">
                    {m.provider === 'GITLAB' ? '!' : '#'}
                    {m.number}
                  </span>{' '}
                  {m.title}
                </span>
                <StatusBadge status={m.status} />
              </button>
            </li>
          ))}
        </ul>
        {isError ? (
          <p className="mt-2 text-xs text-danger">Could not load merge requests.</p>
        ) : null}
        {!isError && !isFetching && items.length === 0 ? (
          <p className="mt-2 text-xs text-fg-muted">No merge requests found.</p>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
