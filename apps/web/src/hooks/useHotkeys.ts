import { useEffect, useRef } from 'react';

type Handlers = Record<string, (event: KeyboardEvent) => void>;

const isEditable = (el: EventTarget | null) =>
  el instanceof HTMLElement &&
  (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));

/**
 * Binds single-key shortcuts (e.g. `/`, `j`, `Escape`) on the document.
 * Ignored while typing in a field or when a modifier is held; `Escape` always fires.
 */
export function useHotkeys(handlers: Handlers, enabled = true): void {
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key !== 'Escape' && isEditable(e.target)) return;
      const handler = ref.current[e.key];
      if (handler) handler(e);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}
