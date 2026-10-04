import type { MergeRequest } from '@mrdash/shared';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/cn';
import { GRID, HEADERS, ROW_HEIGHT } from './columns';
import { MrRow } from './MrRow';

interface Props {
  items: MergeRequest[];
  repoNames: Record<string, string>;
  /** Called when more rows should be fetched (scrolled near the end). */
  onEndReached?: () => void;
  /** True while a new filter is loading and the previous rows are still shown. */
  stale?: boolean;
  /** Sort direction of the Updated column; `undefined` when the list has a fixed order. */
  order?: 'asc' | 'desc' | undefined;
  onOrderChange?: (order: 'asc' | 'desc') => void;
}

function SortHeader({
  order,
  onChange,
}: {
  order: 'asc' | 'desc';
  onChange: Props['onOrderChange'];
}) {
  const Icon = order === 'desc' ? ArrowDown : ArrowUp;
  return (
    <button
      type="button"
      onClick={() => onChange?.(order === 'desc' ? 'asc' : 'desc')}
      className="inline-flex items-center gap-1 hover:text-fg"
    >
      Updated
      <Icon size={12} aria-hidden="true" />
      <span className="sr-only">{order === 'desc' ? 'newest first' : 'oldest first'}</span>
    </button>
  );
}

export function MrTable({ items, repoNames, onEndReached, stale, order, onOrderChange }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const toggle = useCallback(
    (id: string) =>
      setExpanded((prev) => {
        const next = new Set(prev);
        if (!next.delete(id)) next.add(id);
        return next;
      }),
    [],
  );

  const virtual = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
    getItemKey: (i) => items[i]?.id ?? i,
  });
  const rows = virtual.getVirtualItems();
  const top = rows[0]?.start ?? 0;
  const bottom = virtual.getTotalSize() - (rows.at(-1)?.end ?? 0);
  const lastIndex = rows.at(-1)?.index ?? 0;

  useEffect(() => {
    if (onEndReached && items.length > 0 && lastIndex >= items.length - 20) onEndReached();
  }, [lastIndex, items.length, onEndReached]);

  return (
    <div
      ref={scrollRef}
      aria-busy={stale || undefined}
      className={cn(
        'min-h-0 flex-1 overflow-auto rounded-card border border-border bg-surface',
        stale && 'opacity-70',
      )}
    >
      <table
        role="table"
        aria-label="Merge requests"
        aria-rowcount={items.length + 1}
        className="block"
      >
        <thead role="rowgroup" className="sticky top-0 z-10 block bg-surface">
          <tr
            role="row"
            className={cn('grid items-center gap-x-2 border-b border-border px-3 py-2', GRID)}
          >
            {HEADERS.map((h) => (
              <th
                key={h.label}
                role="columnheader"
                scope="col"
                aria-sort={
                  h.sort && order ? (order === 'desc' ? 'descending' : 'ascending') : undefined
                }
                className={cn(
                  'min-w-0 truncate text-left text-xs font-medium text-fg-secondary',
                  h.className,
                )}
              >
                {h.sort && order ? (
                  <SortHeader order={order} onChange={onOrderChange} />
                ) : h.sort ? (
                  <span className="inline-flex items-center gap-1">
                    {h.label}
                    <ChevronsUpDown size={12} aria-hidden="true" className="opacity-0" />
                  </span>
                ) : h.className?.includes('xl:hidden') ? (
                  <span className="sr-only">{h.label}</span>
                ) : (
                  h.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody role="rowgroup" className="block" style={{ paddingTop: top, paddingBottom: bottom }}>
          {rows.map((v) => {
            const mr = items[v.index];
            return mr ? (
              <MrRow
                key={mr.id}
                mr={mr}
                repoName={repoNames[mr.repositoryId] ?? '–'}
                index={v.index}
                expanded={expanded.has(mr.id)}
                onToggle={toggle}
                measure={virtual.measureElement}
              />
            ) : null;
          })}
        </tbody>
      </table>
    </div>
  );
}
