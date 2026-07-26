"use client";

/**
 * Блок 3 — Аналитика.
 *
 * Every dimension of the master sheet, sliced. Each slice is clickable and adds
 * a filter chip, so the same click both explains a number and narrows the whole
 * dashboard to it.
 */
import { useMemo, useState } from "react";

import { BarRow, Donut, Sparkline } from "../charts";
import { money, moneyShort, percent } from "../format";
import type { BbcMode, BbcRow } from "../types";
import { byMonthCycle, groupBy, recognizedTotal, sumBy } from "../use-dataset";
import { RowTable, SectionCard } from "./shared";

type Dimension = {
  key: string;
  title: string;
  pick: (row: BbcRow) => string;
  filterKey?: "firms" | "departments" | "employees" | "serviceKinds";
};

const DIMENSIONS: Dimension[] = [
  { key: "firm", title: "По юрлицам", pick: (row) => row.firm, filterKey: "firms" },
  {
    key: "department",
    title: "По отделам",
    pick: (row) => row.departments[0] ?? "—",
    filterKey: "departments",
  },
  { key: "employee", title: "По сотрудникам", pick: (row) => row.employee, filterKey: "employees" },
  {
    key: "service",
    title: "По видам услуг",
    pick: (row) => row.service_kind,
    filterKey: "serviceKinds",
  },
  { key: "client", title: "По клиентам", pick: (row) => row.client },
];

export function AnalyticsBlock({
  rows,
  mode,
  onFilter,
}: {
  rows: BbcRow[];
  mode: BbcMode;
  onFilter?: (key: "firms" | "departments" | "employees" | "serviceKinds", value: string) => void;
}) {
  const [drill, setDrill] = useState<{ title: string; rows: BbcRow[] } | null>(null);

  const monthly = useMemo(() => byMonthCycle(rows, mode), [rows, mode]);

  /** Per-firm trend line — small multiples read better than one busy chart. */
  const firmTrends = useMemo(() => {
    const byFirm = groupBy(rows, (row) => row.firm);
    return [...byFirm.entries()]
      .map(([firm, firmRows]) => {
        const series = byMonthCycle(firmRows, mode);
        return {
          firm,
          name: firmRows[0]?.firm_name ?? firm,
          total: recognizedTotal(firmRows, mode),
          values: series.map((item) => item.total),
          rows: firmRows,
        };
      })
      .filter((item) => item.total)
      .sort((a, b) => b.total - a.total);
  }, [rows, mode]);

  /** Net-profit-by-department placeholder: revenue only, expenses need the journal. */
  const departmentRevenue = useMemo(() => {
    const byDepartment = groupBy(rows, (row) => row.departments[0] ?? "—");
    return [...byDepartment.entries()]
      .map(([code, groupRows]) => ({
        code,
        total: recognizedTotal(groupRows, mode),
        contracted: sumBy(groupRows, (row) => row.contract_amount),
        rows: groupRows,
      }))
      .sort((a, b) => b.total - a.total);
  }, [rows, mode]);

  return (
    <div className="flex flex-col gap-4">
      <SectionCard
        title="Динамика по фирмам"
        subtitle="Отдельная линия на юрлицо — так видно каждое, а не кашу из семи линий."
      >
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {firmTrends.map((item, index) => (
            <button
              key={item.firm}
              type="button"
              className="row-item p-3 text-left animate-fade-in"
              style={{
                animationDuration: "var(--dur-base)",
                animationDelay: `calc(${index} * var(--dur-stagger))`,
                animationFillMode: "backwards",
              }}
              onClick={() => onFilter?.("firms", item.firm)}
              title={`Фильтровать по ${item.name}`}
            >
              <div className="flex items-baseline justify-between gap-2 mb-1">
                <span className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>
                  {item.firm}
                </span>
                <span className="text-xs bbc-num" style={{ color: "var(--text-secondary)" }}>
                  {moneyShort(item.total)}
                </span>
              </div>
              <Sparkline values={item.values} width={140} height={24} />
              <span className="mono-meta truncate block mt-0.5">{item.name}</span>
            </button>
          ))}
        </div>
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="Выручка по отделам"
          subtitle="Чистая прибыль появится, когда в журнале появятся категории расходов."
        >
          <div className="flex flex-col gap-3">
            {departmentRevenue.map((item, index) => (
              <BarRow
                key={item.code}
                label={item.code}
                value={item.total}
                max={Math.max(...departmentRevenue.map((entry) => entry.total), 1)}
                hint={money(item.total)}
                index={index}
                onClick={() => setDrill({ title: `Отдел ${item.code}`, rows: item.rows })}
              />
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Структура выручки" subtitle="Доли видов услуг в признанной выручке.">
          <ServiceMix rows={rows} mode={mode} />
        </SectionCard>
      </div>

      {DIMENSIONS.map((dimension) => (
        <DimensionCard
          key={dimension.key}
          dimension={dimension}
          rows={rows}
          mode={mode}
          onFilter={onFilter}
          onDrill={(title, drillRows) => setDrill({ title, rows: drillRows })}
        />
      ))}

      <SectionCard
        title="Помесячно"
        subtitle="Признанная выручка в разрезе двух циклов начисления."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Месяц", "Цикл 1", "Цикл 2", "Итого"].map((header) => (
                  <th
                    key={header}
                    className="text-left font-medium px-2 py-1.5"
                    style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border-subtle)" }}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monthly.map((item) => (
                <tr key={item.month}>
                  <td className="px-2 py-1.5" style={{ color: "var(--text-secondary)" }}>
                    {item.month}
                  </td>
                  <td className="px-2 py-1.5 text-right bbc-num" style={{ color: "var(--text-secondary)" }}>
                    {money(item.cycle1)}
                  </td>
                  <td className="px-2 py-1.5 text-right bbc-num" style={{ color: "var(--text-secondary)" }}>
                    {money(item.cycle2)}
                  </td>
                  <td className="px-2 py-1.5 text-right bbc-num font-semibold" style={{ color: "var(--text-primary)" }}>
                    {money(item.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {drill ? (
        <SectionCard
          title={drill.title}
          subtitle={`${drill.rows.length} строк · ${money(sumBy(drill.rows, (row) => row.contract_amount))}`}
          action={
            <button type="button" className="btn-ghost text-xs px-2.5 py-1" onClick={() => setDrill(null)}>
              Закрыть
            </button>
          }
        >
          <RowTable rows={drill.rows} mode={mode} />
        </SectionCard>
      ) : null}
    </div>
  );
}

const MIX_TONES = ["accent", "emerald", "amber", "rose", "muted"] as const;

function ServiceMix({ rows, mode }: { rows: BbcRow[]; mode: BbcMode }) {
  const slices = useMemo(() => {
    const byKind = groupBy(rows, (row) => row.service_kind || "—");
    return [...byKind.entries()]
      .map(([label, kindRows], index) => ({
        label,
        value: recognizedTotal(kindRows, mode),
        tone: MIX_TONES[index % MIX_TONES.length],
      }))
      .filter((slice) => slice.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [rows, mode]);

  const total = slices.reduce((sum, slice) => sum + slice.value, 0);

  return (
    <div className="flex items-center gap-5 flex-wrap">
      <Donut slices={slices} />
      <ul className="flex flex-col gap-1.5 flex-1 min-w-[160px]">
        {slices.map((slice) => (
          <li key={slice.label} className="flex items-center gap-2 text-xs">
            <span
              aria-hidden="true"
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                background:
                  slice.tone === "muted"
                    ? "var(--text-muted)"
                    : `var(--accent-${slice.tone === "accent" ? "" : slice.tone})`.replace(
                        "var(--accent-)",
                        "var(--accent)",
                      ),
              }}
            />
            <span className="truncate" style={{ color: "var(--text-secondary)" }}>
              {slice.label}
            </span>
            <span className="ml-auto bbc-num" style={{ color: "var(--text-primary)" }}>
              {percent(total ? slice.value / total : 0)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DimensionCard({
  dimension,
  rows,
  mode,
  onFilter,
  onDrill,
}: {
  dimension: Dimension;
  rows: BbcRow[];
  mode: BbcMode;
  onFilter?: (key: "firms" | "departments" | "employees" | "serviceKinds", value: string) => void;
  onDrill: (title: string, rows: BbcRow[]) => void;
}) {
  const entries = useMemo(() => {
    const grouped = groupBy(rows, dimension.pick);
    return [...grouped.entries()]
      .map(([label, groupRows]) => ({
        label,
        total: recognizedTotal(groupRows, mode),
        contracted: sumBy(groupRows, (row) => row.contract_amount),
        rows: groupRows,
      }))
      .sort((a, b) => b.contracted - a.contracted)
      .slice(0, 12);
  }, [rows, mode, dimension]);

  if (!entries.length) return null;
  const max = Math.max(...entries.map((entry) => entry.contracted), 1);

  return (
    <SectionCard title={dimension.title} subtitle="Клик по строке — детализация до договоров.">
      <div className="flex flex-col gap-3">
        {entries.map((entry, index) => (
          <BarRow
            key={entry.label}
            label={entry.label || "—"}
            value={entry.contracted}
            max={max}
            hint={money(entry.contracted)}
            index={index}
            onClick={() => {
              if (dimension.filterKey && onFilter) onFilter(dimension.filterKey, entry.label);
              else onDrill(`${dimension.title}: ${entry.label}`, entry.rows);
            }}
          />
        ))}
      </div>
    </SectionCard>
  );
}
