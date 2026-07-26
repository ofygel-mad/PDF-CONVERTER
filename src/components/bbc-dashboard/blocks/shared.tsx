"use client";

/** Pieces shared by every block: cards, KPI tiles, the row table, empty states. */
import { useMemo, type ReactNode } from "react";

import { useChangedKeys } from "../use-live";

import { dateLabel, money, moneyShort, percent } from "../format";
import type { BbcMode, BbcRow } from "../types";

export function SectionCard({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      className="card bbc-grain relative p-4 animate-fade-in"
      style={{ animationDuration: "var(--dur-base)" }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {title}
          </h3>
          {subtitle ? (
            <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
              {subtitle}
            </p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export type KpiItem = {
  label: string;
  value: number;
  format?: "money" | "percent" | "count";
  tone?: "accent" | "emerald" | "amber" | "rose";
  hint?: string;
};

export function KpiStrip({ items }: { items: KpiItem[] }) {
  // Значения, изменившиеся с прошлого рендера — их и подсвечиваем. Так правка в
  // Google Sheets заметна, но страница под курсором не дёргается.
  const values = useMemo(
    () => Object.fromEntries(items.map((item) => [item.label, item.value])),
    [items],
  );
  const changed = useChangedKeys(values);

  return (
    <div className="grid gap-2.5 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
      {items.map((item, index) => (
        <div
          key={item.label}
          className={`card p-3 animate-fade-in${changed.has(item.label) ? " bbc-pulse" : ""}`}
          style={{
            animationDuration: "var(--dur-base)",
            animationDelay: `calc(${index} * var(--dur-stagger))`,
            animationFillMode: "backwards",
          }}
          title={item.hint}
        >
          <p className="eyebrow mb-1 truncate">{item.label}</p>
          <p
            className="text-lg font-semibold bbc-num truncate"
            style={{
              color: item.tone ? `var(--accent-${item.tone === "accent" ? "" : item.tone})`.replace(
                "var(--accent-)",
                "var(--accent)",
              ) : "var(--text-primary)",
              letterSpacing: "-0.02em",
            }}
          >
            {item.format === "percent"
              ? percent(item.value)
              : item.format === "count"
                ? item.value.toLocaleString("ru-RU")
                : moneyShort(item.value)}
          </p>
        </div>
      ))}
    </div>
  );
}

/** The escape hatch: full row detail, so no data is ever hidden from the user. */
export function RowTable({
  rows,
  mode,
  limit = 60,
  onDrill,
}: {
  rows: BbcRow[];
  mode: BbcMode;
  limit?: number;
  onDrill?: (rows: BbcRow[], title: string) => void;
}) {
  if (!rows.length) {
    return (
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        Нет строк в этом срезе.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {["№", "Клиент", "Отдел", "Услуга", "Период", "Договор", "Оплачено", "Признано", "Статус"].map(
              (header) => (
                <th
                  key={header}
                  className="text-left font-medium px-2 py-1.5 whitespace-nowrap"
                  style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border-subtle)" }}
                >
                  {header}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, limit).map((row, index) => {
            const recognized = (row.recognition[mode]?.alloc ?? []).reduce(
              (sum, entry) => sum + entry[3],
              0,
            );
            const wip = row.recognition[mode]?.wip ?? 0;
            return (
              <tr
                key={row.index}
                className="animate-fade-in"
                style={{
                  animationDuration: "var(--dur-fast)",
                  animationDelay: `calc(${Math.min(index, 20)} * var(--dur-stagger) / 2)`,
                  animationFillMode: "backwards",
                }}
              >
                <td className="px-2 py-1.5 mono-meta">{row.index}</td>
                <td
                  className="px-2 py-1.5 max-w-[220px] truncate"
                  style={{ color: "var(--text-primary)" }}
                  title={row.client}
                >
                  {row.client || "—"}
                </td>
                <td className="px-2 py-1.5" style={{ color: "var(--text-secondary)" }}>
                  {row.departments.join(", ") || "—"}
                </td>
                <td className="px-2 py-1.5" style={{ color: "var(--text-secondary)" }}>
                  {row.service_kind || "—"}
                </td>
                <td className="px-2 py-1.5 mono-meta whitespace-nowrap">
                  {row.period_start ? dateLabel(row.period_start) : "—"}
                  {row.period_end ? ` – ${dateLabel(row.period_end)}` : ""}
                </td>
                <td className="px-2 py-1.5 text-right bbc-num" style={{ color: "var(--text-primary)" }}>
                  {money(row.contract_amount)}
                </td>
                <td className="px-2 py-1.5 text-right bbc-num" style={{ color: "var(--text-secondary)" }}>
                  {money(row.paid_amount)}
                </td>
                <td className="px-2 py-1.5 text-right bbc-num">
                  {recognized ? (
                    <span style={{ color: "var(--accent-emerald)" }}>{money(recognized)}</span>
                  ) : wip ? (
                    <span style={{ color: "var(--accent-amber)" }} title="Ожидает: нет дат периода">
                      {money(wip)} · WIP
                    </span>
                  ) : (
                    <span style={{ color: "var(--text-muted)" }}>—</span>
                  )}
                </td>
                <td className="px-2 py-1.5" style={{ color: "var(--text-secondary)" }}>
                  {row.status || "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {rows.length > limit ? (
        <p className="mono-meta mt-2 px-2">
          показано {limit} из {rows.length}
          {onDrill ? " — уточните фильтр, чтобы увидеть остальные" : ""}
        </p>
      ) : null}
    </div>
  );
}

/** Honest empty state: names the missing data instead of saying "нет данных". */
export function PendingBlock({
  title,
  what,
  missing,
  icon,
}: {
  title: string;
  what: string;
  missing: string[];
  icon?: ReactNode;
}) {
  return (
    <SectionCard title={title} subtitle={what}>
      <div className="flex items-start gap-3">
        {icon ? <span style={{ color: "var(--text-muted)" }}>{icon}</span> : null}
        <div>
          <p className="eyebrow mb-2">Чего не хватает</p>
          <ul className="flex flex-col gap-1.5">
            {missing.map((item) => (
              <li key={item} className="text-xs flex items-start gap-2" style={{ color: "var(--text-secondary)" }}>
                <span aria-hidden="true" style={{ color: "var(--accent-amber)" }}>
                  •
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </SectionCard>
  );
}
