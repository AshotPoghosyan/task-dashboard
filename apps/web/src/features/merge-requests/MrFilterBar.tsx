import { useFilterOptions } from '../../api/tasks';
import { FilterBar } from '../../components/data/FilterBar';
import { MultiSelect } from '../../components/ui/MultiSelect';
import type { Filters } from '../../hooks/useUrlFilters';
import { buildChips, FILTER_KEYS, FILTER_LABELS, optionsByKey } from './filters';

interface Props {
  filters: Filters;
  search: string;
  setFilter: (key: string, values: string[]) => void;
  setSearch: (q: string) => void;
  clearAll: () => void;
}

/** Filter controls bound to the URL. Search lives in the top bar and shows as a chip. */
export function MrFilterBar({ filters, search, setFilter, setSearch, clearAll }: Props) {
  const { data } = useFilterOptions();
  const options = optionsByKey(data);
  return (
    <FilterBar
      chips={buildChips(filters, search, options)}
      onClearAll={clearAll}
      onRemove={(chip) => {
        if (chip.key === 'q') return setSearch('');
        setFilter(
          chip.key,
          (filters[chip.key] ?? []).filter((v) => v !== (chip.raw ?? chip.value)),
        );
      }}
    >
      {FILTER_KEYS.map((key) => (
        <MultiSelect
          key={key}
          label={FILTER_LABELS[key]}
          options={options[key] ?? []}
          value={filters[key] ?? []}
          onChange={(v) => setFilter(key, v)}
        />
      ))}
    </FilterBar>
  );
}
