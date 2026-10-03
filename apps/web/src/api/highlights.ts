import { useSyncExternalStore } from 'react';

export const HIGHLIGHT_MS = 3000;

/** Ids of rows that were just updated live; each entry expires on its own. */
export function createHighlightStore(duration = HIGHLIGHT_MS) {
  const ids = new Set<string>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());

  return {
    add(id: string) {
      clearTimeout(timers.get(id));
      ids.add(id);
      timers.set(
        id,
        setTimeout(() => {
          ids.delete(id);
          timers.delete(id);
          emit();
        }, duration),
      );
      emit();
    },
    has: (id: string) => ids.has(id),
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}
export type HighlightStore = ReturnType<typeof createHighlightStore>;

export const highlights = createHighlightStore();

/** True for a few seconds after the row with `id` changed via SSE. Only that row re-renders. */
export const useHighlighted = (id: string) =>
  useSyncExternalStore(highlights.subscribe, () => highlights.has(id));
