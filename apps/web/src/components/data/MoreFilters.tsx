import { SlidersHorizontal } from 'lucide-react';
import type { Filters } from '../../hooks/useUrlFilters';
import { Button } from '../ui/Button';
import { MultiSelect } from '../ui/MultiSelect';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/Popover';
import type { Option } from '../ui/Select';

export interface FilterDef {
  key: string;
  label: string;
  options: Option[];
}

interface MoreFiltersProps {
  defs: FilterDef[];
  values: Filters;
  onChange: (key: string, values: string[]) => void;
}

/** The one button that holds every secondary filter; shows how many are active. */
export function MoreFilters({ defs, values, onChange }: MoreFiltersProps) {
  const active = defs.reduce((n, d) => n + (values[d.key]?.length ?? 0), 0);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button>
          <SlidersHorizontal size={14} aria-hidden="true" /> More filters
          {active > 0 ? (
            <span className="tabular rounded-control bg-accent px-1.5 text-xs font-medium text-accent-fg">
              {active}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="flex w-64 flex-col gap-2">
        {defs.map((d) => (
          <MultiSelect
            key={d.key}
            label={d.label}
            options={d.options}
            value={values[d.key] ?? []}
            onChange={(v) => onChange(d.key, v)}
            className="w-full justify-between"
          />
        ))}
      </PopoverContent>
    </Popover>
  );
}
