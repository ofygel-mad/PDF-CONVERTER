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

/**
 * Мера, общая для всех разрезов блока.
 *
 * Раньше пончик считал признанную выручку, а списки под ним — суммы договоров,
 * и на одном экране получались два разных «100%». Теперь мера одна и её выбирает
 * пользователь: любые две карточки блока всегда сопоставимы между собой.
 */
type Measure = "recognized" | "contracted";

const MEASURES: Array<{ key: Measure; title: string; hint: string }> = [
  {
    key: "recognized",
    title: "Признано",
    hint: "Заработано в текущем режиме признания. Разовые «на исполнении» сюда не входят.",
  },
  {
    key: "contracted",
    title: "Сумма договоров",
    hint: "Вся законтрактованная сумма, независимо от того, признана она или ещё нет.",
  },
];

/** Пустое значение — это не «—», а конкретный пробел в данных. Так строку
    можно узнать в блоке «Предупреждения» и починить в таблице. */
const UNSET = {
  firm: "Юрлицо не указано",
  department: "Отдел не задан",
  employee: "Сотрудник не назначен",
  service: "Вид услуги не указан",
  client: "Клиент не указан",
};

// Отдела здесь намеренно нет: он разобран отдельной карточкой «По отделам»
// выше, и второй такой же список в том же блоке только сбивал с толку.
const DIMENSIONS: Dimension[] = [
  { key: "firm", title: "По юрлицам", pick: (row) => row.firm || UNSET.firm, filterKey: "firms" },
  {
    key: "employee",
    title: "По сотрудникам",
    pick: (row) => row.employee || UNSET.employee,
    filterKey: "employees",
  },
  {
    key: "service",
    title: "По видам услуг",
    pick: (row) => row.service_kind || UNSET.service,
    filterKey: "serviceKinds",
  },
  { key: "client", title: "По клиентам", pick: (row) => row.client || UNSET.client },
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
  const [measure, setMeasure] = useState<Measure>("recognized");

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
      .filter((item) => item.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [rows, mode]);

  /** Net-profit-by-department placeholder: revenue only, expenses need the journal. */
  const departmentRevenue = useMemo(() => {
    const byDepartment = groupBy(rows, (row) => row.departments[0] || UNSET.department);
    return [...byDepartment.entries()]
      .map(([code, groupRows]) => {
        const recognized = recognizedTotal(groupRows, mode);
        const contracted = sumBy(groupRows, (row) => row.contract_amount);
        return {
          code,
          value: measure === "recognized" ? recognized : contracted,
          recognized,
          contracted,
          rows: groupRows,
        };
      })
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [rows, mode, measure]);

  const measureHint = MEASURES.find((item) => item.key === measure)?.hint ?? "";

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

      <div
        className="card p-3 flex items-center justify-between gap-3 flex-wrap animate-fade-in"
        style={{ animationDuration: "var(--dur-base)" }}
      >
        <div className="min-w-0">
          <p className="eyebrow mb-0.5">Мера всех разрезов ниже</p>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {measureHint}
          </p>
        </div>
        <div className="flex gap-1.5">
          {MEASURES.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setMeasure(item.key)}
              className="text-xs px-3 py-1.5 rounded-lg"
              aria-pressed={measure === item.key}
              style={{
                background: measure === item.key ? "var(--accent-soft)" : "var(--bg-active)",
                border: `1px solid ${measure === item.key ? "var(--accent-line)" : "transparent"}`,
                color: measure === item.key ? "var(--text-accent)" : "var(--text-secondary)",
                transition: "background var(--dur-fast), color var(--dur-fast)",
              }}
            >
              {item.title}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="По отделам"
          subtitle="Чистая прибыль появится, когда в журнале появятся категории расходов."
        >
          <div className="flex flex-col gap-3">
            {departmentRevenue.map((item, index) => (
              <BarRow
                key={item.code}
                label={item.code}
                value={item.value}
                max={Math.max(...departmentRevenue.map((entry) => entry.value), 1)}
                total={departmentRevenue.reduce((sum, entry) => sum + entry.value, 0)}
                hint={money(item.value)}
                index={index}
                onClick={() =>
                  onFilter
                    ? onFilter("departments", item.code)
                    : setDrill({ title: `Отдел ${item.code}`, rows: item.rows })
                }
              />
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Структура выручки"
          subtitle="Те же строки и та же мера, что и в разрезах ниже — доли сходятся между карточками."
        >
          <ServiceMix rows={rows} mode={mode} measure={measure} />
        </SectionCard>
      </div>

      {DIMENSIONS.map((dimension) => (
        <DimensionCard
          key={dimension.key}
          dimension={dimension}
          rows={rows}
          mode={mode}
          measure={measure}
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

function ServiceMix({
  rows,
  mode,
  measure,
}: {
  rows: BbcRow[];
  mode: BbcMode;
  measure: Measure;
}) {
  const slices = useMemo(() => {
    const byKind = groupBy(rows, (row) => row.service_kind || UNSET.service);
    return [...byKind.entries()]
      .map(([label, kindRows]) => ({
        label,
        value:
          measure === "recognized"
            ? recognizedTotal(kindRows, mode)
            : sumBy(kindRows, (row) => row.contract_amount),
      }))
      .filter((slice) => slice.value > 0)
      .sort((a, b) => b.value - a.value)
      // Цвет назначаем после сортировки, иначе крупнейшей доле доставался
      // случайный оттенок, а акцент дизайн-системы уходил на хвост.
      .map((slice, index) => ({ ...slice, tone: MIX_TONES[index % MIX_TONES.length] }));
  }, [rows, mode, measure]);

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
  measure,
  onFilter,
  onDrill,
}: {
  dimension: Dimension;
  rows: BbcRow[];
  mode: BbcMode;
  measure: Measure;
  onFilter?: (key: "firms" | "departments" | "employees" | "serviceKinds", value: string) => void;
  onDrill: (title: string, rows: BbcRow[]) => void;
}) {
  const entries = useMemo(() => {
    const grouped = groupBy(rows, dimension.pick);
    return [...grouped.entries()]
      .map(([label, groupRows]) => ({
        label,
        value:
          measure === "recognized"
            ? recognizedTotal(groupRows, mode)
            : sumBy(groupRows, (row) => row.contract_amount),
        rows: groupRows,
      }))
      .filter((entry) => entry.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);
  }, [rows, mode, measure, dimension]);

  if (!entries.length) return null;
  const max = Math.max(...entries.map((entry) => entry.value), 1);
  const total = entries.reduce((sum, entry) => sum + entry.value, 0);

  return (
    <SectionCard
      title={dimension.title}
      subtitle="Длина полоски — относительно крупнейшего в списке; доля справа — от суммы списка."
    >
      <div className="flex flex-col gap-3">
        {entries.map((entry, index) => (
          <BarRow
            key={entry.label}
            label={entry.label}
            value={entry.value}
            max={max}
            total={total}
            hint={money(entry.value)}
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
