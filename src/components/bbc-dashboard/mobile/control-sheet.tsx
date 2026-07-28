"use client";

/**
 * Лист управления — режим признания и фильтры.
 *
 * Открывается из строки контекста. Панель управления при этом не занимает
 * вкладку в нижнем баре: раздел с настройками нужен реже, чем любой из четырёх
 * с данными, а дотянуться до него надо из любого места — строка контекста для
 * этого и стоит прямо под шапкой.
 */
import { FilterBar, ModeSwitches, type FilterKey } from "../controls";
import type { Filters } from "../use-dataset";
import type { BbcDataset, BbcMode } from "../types";
import { BottomSheet } from "./bottom-sheet";

export function ControlSheet({
  open,
  onClose,
  dataset,
  mode,
  onMode,
  filters,
  onToggleFilter,
  onSearch,
  onClearFilters,
  activeFilterCount,
  visibleRows,
  totalRows,
  onOpenPanel,
}: {
  open: boolean;
  onClose: () => void;
  dataset: BbcDataset;
  mode: BbcMode;
  onMode: (mode: BbcMode) => void;
  filters: Filters;
  onToggleFilter: (key: FilterKey, value: string) => void;
  onSearch: (value: string) => void;
  onClearFilters: () => void;
  activeFilterCount: number;
  visibleRows: number;
  totalRows: number;
  /** Полная панель — там же пресеты и сохранённые виды. */
  onOpenPanel: () => void;
}) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Что показывать"
      subtitle="Способ признания и фильтры"
      detent="full"
      footer={
        <button
          type="button"
          onClick={onOpenPanel}
          className="btn-ghost w-full text-xs flex items-center justify-center"
        >
          Открыть панель управления целиком
        </button>
      }
    >
      <div className="flex flex-col gap-4 pb-3">
        <ModeSwitches dataset={dataset} mode={mode} onMode={onMode} />

        <div>
          <p className="eyebrow mb-2">Фильтры</p>
          <FilterBar
            dataset={dataset}
            filters={filters}
            onToggle={onToggleFilter}
            onSearch={onSearch}
            onClear={onClearFilters}
            activeCount={activeFilterCount}
            visibleRows={visibleRows}
            totalRows={totalRows}
            alwaysOpen
          />
        </div>
      </div>
    </BottomSheet>
  );
}
