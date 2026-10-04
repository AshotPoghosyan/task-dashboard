import { CircleHelp } from 'lucide-react';
import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/Popover';

export interface TabDef {
  id: string;
  label: string;
  /** Badge number; hidden while unknown. */
  count?: number | undefined;
}

interface StatusTabsProps {
  label: string;
  tabs: TabDef[];
  value: string;
  onChange: (id: string) => void;
  /** Id of the element that shows the selected tab's content. */
  panelId: string;
  /** One-sentence explanations shown behind the "?" button. */
  help: { term: string; text: string }[];
}

const tabId = (id: string) => `tab-${id}`;

/** Status tabs with counts. Arrow keys move between tabs (Home/End jump); the selection is controlled. */
export function StatusTabs({ label, tabs, value, onChange, panelId, help }: StatusTabsProps) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  const onKeyDown = (e: KeyboardEvent) => {
    const index = tabs.findIndex((t) => t.id === value);
    const target =
      e.key === 'ArrowRight'
        ? tabs[(index + 1) % tabs.length]
        : e.key === 'ArrowLeft'
          ? tabs[(index - 1 + tabs.length) % tabs.length]
          : e.key === 'Home'
            ? tabs[0]
            : e.key === 'End'
              ? tabs.at(-1)
              : undefined;
    if (!target) return;
    e.preventDefault();
    onChange(target.id);
    refs.current[target.id]?.focus();
  };

  return (
    <div className="flex items-center gap-1 border-b border-border">
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="flex min-w-0 gap-1 overflow-x-auto"
      >
        {tabs.map((t) => {
          const selected = t.id === value;
          return (
            <button
              key={t.id}
              ref={(el) => {
                refs.current[t.id] = el;
              }}
              id={tabId(t.id)}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={panelId}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(t.id)}
              className={cn(
                '-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm hover:text-fg',
                selected
                  ? 'border-accent font-medium text-fg'
                  : 'border-transparent text-fg-secondary',
              )}
            >
              {t.label}
              {t.count !== undefined ? (
                <span className="tabular rounded-full bg-raised px-1.5 text-xs text-fg-secondary">
                  {t.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <StatusHelp help={help} />
    </div>
  );
}

export const tabPanelProps = (panelId: string, active: string) => ({
  id: panelId,
  role: 'tabpanel' as const,
  'aria-labelledby': tabId(active),
});

function StatusHelp({ help }: { help: StatusTabsProps['help'] }): ReactNode {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="What do these tabs mean?"
          className="shrink-0 rounded-full p-1 text-fg-secondary hover:text-fg"
        >
          <CircleHelp size={16} aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <h2 className="mb-2 text-xs font-medium text-fg-secondary">What the tabs mean</h2>
        <dl className="flex flex-col gap-2">
          {help.map((h) => (
            <div key={h.term}>
              <dt className="text-sm font-medium">{h.term}</dt>
              <dd className="text-xs text-fg-secondary">{h.text}</dd>
            </div>
          ))}
        </dl>
      </PopoverContent>
    </Popover>
  );
}
