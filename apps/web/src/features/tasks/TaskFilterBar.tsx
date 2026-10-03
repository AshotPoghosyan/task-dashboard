import { useFilterOptions } from '../../api/tasks';
import { FilterBar } from '../../components/data/FilterBar';
import { MultiSelect } from '../../components/ui/MultiSelect';
import type { Filters } from '../../hooks/useUrlFilters';
import { buildChips, rawValue, STATUS_OPTIONS, TYPE_OPTIONS } from './filters';

interface Props {
  filters: Filters;
  search: string;
  setFilter: (key: string, values: string[]) => void;
  setSearch: (q: string) => void;
  clearAll: () => void;
}

const asOptions = (values: string[]) => values.map((v) => ({ value: v, label: v }));

/** Filter controls bound to the URL. Search lives in the top bar (`/` focuses it) and shows as a chip. */
export function TaskFilterBar({ filters, search, setFilter, setSearch, clearAll }: Props) {
  const { data } = useFilterOptions();
  const select = (key: string, label: string, options: { value: string; label: string }[]) => (
    <MultiSelect
      label={label}
      options={options}
      value={filters[key] ?? []}
      onChange={(v) => setFilter(key, v)}
    />
  );
  return (
    <FilterBar
      chips={buildChips(filters, search)}
      onClearAll={clearAll}
      onRemove={(chip) => {
        if (chip.key === 'q') return setSearch('');
        const raw = rawValue(chip);
        setFilter(
          chip.key,
          (filters[chip.key] ?? []).filter((v) => v !== raw),
        );
      }}
    >
      {select('status', 'Status', STATUS_OPTIONS)}
      {select('assignee', 'Assignee', asOptions(data?.assignees ?? []))}
      {select('targetBranch', 'Target branch', asOptions(data?.branches ?? []))}
      {select('type', 'Type', TYPE_OPTIONS)}
    </FilterBar>
  );
}
