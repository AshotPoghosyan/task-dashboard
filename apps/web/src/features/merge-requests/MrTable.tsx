import type { MergeRequest } from '@mrdash/shared';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useRef } from 'react';
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
}

export function MrTable({ items, repoNames, onEndReached, stale }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
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
        className="block min-w-fit"
      >
        <thead role="rowgroup" className="sticky top-0 z-10 block bg-surface">
          <tr
            role="row"
            className={cn('grid items-center gap-3 border-b border-border px-3 py-2', GRID)}
          >
            {HEADERS.map((h) => (
              <th
                key={h.label}
                role="columnheader"
                scope="col"
                className={cn('text-left text-xs font-medium text-fg-secondary', h.className)}
              >
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody role="rowgroup" className="block" style={{ paddingTop: top, paddingBottom: bottom }}>
          {rows.map((v) => {
            const mr = items[v.index];
            return mr ? (
              <MrRow key={mr.id} mr={mr} repoName={repoNames[mr.repositoryId] ?? '–'} />
            ) : null;
          })}
        </tbody>
      </table>
    </div>
  );
}
