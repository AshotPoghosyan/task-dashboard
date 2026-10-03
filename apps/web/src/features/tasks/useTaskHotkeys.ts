import { useEffect, useState } from 'react';
import { useHotkeys } from '../../hooks/useHotkeys';

interface Options {
  ids: string[];
  enabled: boolean;
  onOpen: (id: string) => void;
  onToggle: (id: string) => void;
}

/** j/k move the selection, Enter opens it, `e` toggles expansion. (`/` and Esc are handled elsewhere.) */
export function useTaskHotkeys({ ids, enabled, onOpen, onToggle }: Options) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Drop a selection that was filtered away.
  useEffect(() => {
    if (selectedId && !ids.includes(selectedId)) setSelectedId(null);
  }, [ids, selectedId]);

  const move = (delta: 1 | -1) => (e: KeyboardEvent) => {
    e.preventDefault();
    if (ids.length === 0) return;
    const i = selectedId ? ids.indexOf(selectedId) : -1;
    const next =
      i === -1
        ? delta === 1
          ? 0
          : ids.length - 1
        : Math.min(ids.length - 1, Math.max(0, i + delta));
    setSelectedId(ids[next] ?? null);
  };

  useHotkeys(
    {
      j: move(1),
      k: move(-1),
      Enter: (e) => {
        // Let focused buttons/links handle their own Enter.
        if (
          selectedId &&
          !(e.target instanceof HTMLButtonElement || e.target instanceof HTMLAnchorElement)
        ) {
          // Without this the Enter keypress would activate whatever the drawer focuses first.
          e.preventDefault();
          onOpen(selectedId);
        }
      },
      e: () => selectedId && onToggle(selectedId),
    },
    enabled,
  );
  return { selectedId, setSelectedId };
}
