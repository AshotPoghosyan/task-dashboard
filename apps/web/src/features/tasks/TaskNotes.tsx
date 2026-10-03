import { useEffect, useRef, useState } from 'react';
import { useUpdateTask } from '../../api/tasks';
import { useDebounce } from '../../hooks/useDebounce';

export const NOTES_DEBOUNCE_MS = 800;

/** Notes editor that autosaves (debounced) and flushes pending text when it unmounts. */
export function TaskNotes({ taskId, saved }: { taskId: string; saved: string | null }) {
  const update = useUpdateTask();
  const [text, setText] = useState(saved ?? '');
  const debounced = useDebounce(text, NOTES_DEBOUNCE_MS);
  const lastSaved = useRef(saved ?? '');
  const latest = useRef(text);
  latest.current = text;

  const save = (value: string) => {
    if (value === lastSaved.current) return;
    lastSaved.current = value;
    update.mutate({ id: taskId, changes: { notes: value.trim() === '' ? null : value } });
  };

  useEffect(() => save(debounced), [debounced]);
  // Flush on close/unmount so edits made inside the debounce window are not lost.
  useEffect(() => () => save(latest.current), []);

  const dirty = text !== lastSaved.current;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="task-notes" className="text-xs font-medium text-fg-secondary">
        Notes
      </label>
      <textarea
        id="task-notes"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        maxLength={10_000}
        className="w-full rounded-control border border-border bg-bg p-2 text-sm text-fg"
      />
      <p role="status" className="text-xs text-fg-muted">
        {dirty || update.isPending
          ? 'Saving…'
          : update.isError
            ? 'Not saved'
            : 'Saved automatically'}
      </p>
    </div>
  );
}
