"use client";

/**
 * Блок 1 — Дебиторка.
 *
 * Экран отвечает на вопрос, ради которого его открывают: кто сколько должен.
 * Реестр клиентов по убыванию долга, раскрытие — из чего долг сложился,
 * аналитика — в «Итогах».
 *
 * Долг не считается здесь. Его считает книга (колонка «Дебет / Кредит»), а
 * бэкенд раскладывает по строкам вместе с входящим остатком. Фронт группирует
 * и показывает — иначе цифра на экране разошлась бы с той, по которой живёт
 * отдел, и спорить стали бы с дашбордом, а не с таблицей.
 */
import { useMemo, useState } from "react";

import { money, plural } from "../../format";
import { PieChartIcon } from "../../icon";
import type { BbcDataset, BbcMode, BbcRow } from "../../types";
import type { FilterKey } from "../../controls";
import type { Filters } from "../../use-dataset";
import { OVERDUE_DAYS } from "./age-track";
import { buildRegistry, debtByDepartment, registryTotals } from "./debt";
import { Registry } from "./registry";
import { Toolbar } from "./toolbar";
import { TotalsSheet } from "./totals-sheet";

export function ReceivablesBlock({
  dataset,
  rows,
  mode,
  filters,
  onToggleFilter,
  onSearch,
  onClearFilters,
  activeFilterCount,
}: {
  dataset: BbcDataset;
  rows: BbcRow[];
  mode: BbcMode;
  filters: Filters;
  onToggleFilter: (key: FilterKey, value: string) => void;
  onSearch: (value: string) => void;
  onClearFilters: () => void;
  activeFilterCount: number;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [totalsOpen, setTotalsOpen] = useState(false);
  const [focus, setFocus] = useState<{ title: string; rows: BbcRow[] } | null>(null);
  const [minDebt, setMinDebt] = useState(0);
  const [overdueOnly, setOverdueOnly] = useState(false);

  const registry = useMemo(() => buildRegistry(rows), [rows]);
  const byDepartment = useMemo(() => debtByDepartment(rows), [rows]);

  const shown = useMemo(
    () =>
      registry.filter((client) => {
        if (minDebt && client.debt < minDebt) return false;
        if (overdueOnly && (client.ageDays ?? 0) <= OVERDUE_DAYS) return false;
        return true;
      }),
    [registry, minDebt, overdueOnly],
  );

  const totals = useMemo(() => registryTotals(shown), [shown]);

  function toggleClient(key: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-2xl font-semibold bbc-num" style={{ color: "var(--text-primary)" }}>
            {money(totals.debt)} ₸
          </p>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            должны {totals.debtors}{" "}
            {plural(totals.debtors, "клиент", "клиента", "клиентов")} из {totals.clients}
            {totals.pending > 0 ? ` · предстоит ${money(totals.pending)} ₸` : ""}
            {/* Неполнота — это не мелочь: итог занижен ровно на эти строки. */}
            {totals.broken > 0
              ? ` · у ${totals.broken} ${plural(totals.broken, "клиента", "клиентов", "клиентов")} долг посчитан не полностью`
              : ""}
          </p>
        </div>

        <button
          type="button"
          className="btn-ghost text-xs px-3 py-1.5"
          onClick={() => setTotalsOpen(true)}
        >
          <PieChartIcon />
          Итоги
        </button>
      </div>

      <Toolbar
        dataset={dataset}
        filters={filters}
        onToggleFilter={onToggleFilter}
        onSearch={onSearch}
        onClear={onClearFilters}
        activeFilterCount={activeFilterCount}
        debtByDepartment={byDepartment}
        minDebt={minDebt}
        onMinDebt={setMinDebt}
        overdueOnly={overdueOnly}
        onOverdueOnly={setOverdueOnly}
      />

      <Registry
        clients={shown}
        expanded={expanded}
        onToggle={toggleClient}
        showDepartments={dataset.dimensions.departments.length > 1}
      />

      {totalsOpen ? (
        <TotalsSheet
          rows={rows}
          mode={mode}
          focus={focus}
          onFocus={setFocus}
          onClose={() => {
            setTotalsOpen(false);
            setFocus(null);
          }}
        />
      ) : null}
    </div>
  );
}
