import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '../ui/Button';

export interface FilterChip {
  key: string;
  label: string;
  value: string;
  /** Underlying filter value when `value` is a display label. */
  raw?: string;
}

interface FilterBarProps {
  chips: FilterChip[];
  onRemove: (chip: FilterChip) => void;
  onClearAll: () => void;
  /** Search input and filter controls. */
  children?: ReactNode;
}

export function FilterBar({ chips, onRemove, onClearAll, children }: FilterBarProps) {
  return (
    <div role="search" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">{children}</div>
      {chips.length > 0 ? (
        <ul aria-label="Active filters" className="flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <li
              key={`${chip.key}:${chip.raw ?? chip.value}`}
              className="inline-flex items-center gap-1 rounded-control border border-border bg-raised py-0.5 pl-2 pr-1 text-xs text-fg"
            >
              <span className="text-fg-secondary">{chip.label}:</span> {chip.value}
              <button
                type="button"
                aria-label={`Remove filter ${chip.label}: ${chip.value}`}
                onClick={() => onRemove(chip)}
                className="rounded-control p-0.5 text-fg-secondary hover:text-fg"
              >
                <X size={12} aria-hidden="true" />
              </button>
            </li>
          ))}
          <li>
            <Button variant="ghost" size="sm" onClick={onClearAll}>
              Clear all
            </Button>
          </li>
        </ul>
      ) : null}
    </div>
  );
}
