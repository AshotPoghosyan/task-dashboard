import * as Menu from '@radix-ui/react-dropdown-menu';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/cn';
import type { Option } from './Select';

interface MultiSelectProps {
  label: string;
  options: Option[];
  value: string[];
  onChange: (value: string[]) => void;
  className?: string;
}

/**
 * Multi-value picker built on a Radix menu of checkbox items: arrow keys move,
 * Space/Enter toggle, Esc closes. The menu stays open while toggling.
 */
export function MultiSelect({ label, options, value, onChange, className }: MultiSelectProps) {
  const toggle = (v: string, checked: boolean) =>
    onChange(checked ? [...value, v] : value.filter((x) => x !== v));

  return (
    <Menu.Root>
      <Menu.Trigger
        className={cn(
          'inline-flex h-8 items-center gap-2 rounded-control border border-border bg-bg px-2 text-sm text-fg',
          className,
        )}
      >
        {label}
        {value.length > 0 ? (
          <span className="tabular rounded-control bg-accent px-1.5 text-xs font-medium text-accent-fg">
            {value.length}
          </span>
        ) : null}
        <ChevronDown size={14} aria-hidden="true" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          align="start"
          sideOffset={4}
          className="z-50 max-h-72 min-w-44 overflow-y-auto rounded-card border border-border bg-raised p-1"
        >
          {options.length === 0 ? (
            <div className="px-2 py-1.5 text-sm text-fg-muted">No options</div>
          ) : null}
          {options.map((o) => (
            <Menu.CheckboxItem
              key={o.value}
              checked={value.includes(o.value)}
              onCheckedChange={(c) => toggle(o.value, c)}
              onSelect={(e) => e.preventDefault()}
              className="flex cursor-default items-center gap-2 rounded-control px-2 py-1.5 text-sm text-fg data-[highlighted]:bg-surface"
            >
              <span className="flex h-4 w-4 items-center justify-center">
                <Menu.ItemIndicator>
                  <Check size={14} aria-hidden="true" />
                </Menu.ItemIndicator>
              </span>
              {o.label}
            </Menu.CheckboxItem>
          ))}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
