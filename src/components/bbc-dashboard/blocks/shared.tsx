"use client";

/** Pieces shared by every block: cards, KPI tiles, the row table, empty states. */
import { useMemo, type ReactNode } from "react";

import { useCountUp } from "../use-count-up";
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
      // Имя для FLIP: по нему карточку узнают до и после перестройки сетки,
      // чтобы она перелетела на новое место, а не мигнула там.
      data-flip-id={`section:${title}`}
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
    <div className="bbc-kpi-grid grid gap-2.5 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
      {items.map((item, index) => (
        <KpiTile
          key={item.label}
          item={item}
          index={index}
          pulsing={changed.has(item.label)}
        />
      ))}
    </div>
  );
}

function KpiTile({
  item,
  index,
  pulsing,
}: {
  item: KpiItem;
  index: number;
  pulsing: boolean;
}) {
  const shown = useCountUp(item.value);
  const tone = item.tone
    ? `var(--accent-${item.tone === "accent" ? "" : item.tone})`.replace(
        "var(--accent-)",
        "var(--accent)",
      )
    : "var(--text-primary)";

  // В плитке число сокращено до «189 млн» — точное значение нужно уметь
  // достать, не уходя в реестр. Поэтому оно всегда в подсказке, а свой hint
  // блока приписывается к нему, а не вместо него.
  const exact =
    item.format === "percent"
      ? percent(item.value)
      : item.format === "count"
        ? Math.round(item.value).toLocaleString("ru-RU")
        : `${money(item.value)} ₸`;

  return (
    <div
      className={`bbc-kpi-tile card p-3 animate-fade-in bbc-tile${pulsing ? " bbc-pulse" : ""}`}
      data-flip-id={`kpi:${item.label}`}
      style={{
        animationDuration: "var(--dur-base)",
        animationDelay: `calc(${index} * var(--dur-stagger))`,
        animationFillMode: "backwards",
      }}
      title={item.hint ? `${exact} — ${item.hint}` : exact}
    >
      <p className="eyebrow mb-1 truncate">{item.label}</p>
      <p
        className="bbc-kpi-value text-lg font-semibold bbc-num truncate"
        style={{ color: tone, letterSpacing: "-0.02em" }}
      >
        {item.format === "percent"
          ? percent(shown)
          : item.format === "count"
            ? Math.round(shown).toLocaleString("ru-RU")
            : moneyShort(shown)}
      </p>
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
            {COLUMNS.map((column) => (
              <th
                key={column.key}
                data-optional={column.optional ? "" : undefined}
                className={`font-medium px-2 py-1.5 whitespace-nowrap ${
                  column.align === "right" ? "text-right" : "text-left"
                }`}
                style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border-subtle)" }}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, limit).map((row, index) => (
            <tr
              key={row.index}
              className="animate-fade-in"
              style={{
                animationDuration: "var(--dur-fast)",
                animationDelay: `calc(${Math.min(index, 20)} * var(--dur-stagger) / 2)`,
                animationFillMode: "backwards",
              }}
            >
              {COLUMNS.map((column) => (
                <td
                  key={column.key}
                  data-optional={column.optional ? "" : undefined}
                  className={`px-2 py-1.5 ${column.cellClass ?? ""}`}
                  style={{ color: column.tone ?? "var(--text-secondary)" }}
                  title={column.title?.(row)}
                >
                  {column.render(row, mode)}
                </td>
              ))}
            </tr>
          ))}
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

/**
 * Колонки реестра, описанные один раз.
 *
 * `optional` — то, без чего строку всё ещё можно прочитать: в компактном режиме
 * эти колонки уходят, и на экран влезает вдвое больше строк. Договор, оплата и
 * признание не помечены никогда — ради них таблицу и открывают.
 */
type RowColumn = {
  key: string;
  header: string;
  align?: "left" | "right";
  optional?: boolean;
  cellClass?: string;
  tone?: string;
  title?: (row: BbcRow) => string | undefined;
  render: (row: BbcRow, mode: BbcMode) => ReactNode;
};

const COLUMNS: RowColumn[] = [
  {
    key: "index",
    header: "№",
    optional: true,
    cellClass: "mono-meta",
    render: (row) => row.index,
  },
  {
    key: "client",
    header: "Клиент",
    cellClass: "max-w-[220px] truncate",
    tone: "var(--text-primary)",
    title: (row) => row.client || undefined,
    render: (row) => row.client || "—",
  },
  {
    key: "departments",
    header: "Отдел",
    optional: true,
    render: (row) => row.departments.join(", ") || "—",
  },
  {
    key: "service",
    header: "Услуга",
    optional: true,
    render: (row) => row.service_kind || "—",
  },
  {
    key: "period",
    header: "Период",
    cellClass: "mono-meta whitespace-nowrap",
    render: (row) =>
      `${row.period_start ? dateLabel(row.period_start) : "—"}${
        row.period_end ? ` – ${dateLabel(row.period_end)}` : ""
      }`,
  },
  {
    key: "contract",
    header: "Договор",
    align: "right",
    cellClass: "text-right bbc-num",
    tone: "var(--text-primary)",
    render: (row) => money(row.contract_amount),
  },
  {
    key: "paid",
    header: "Оплачено",
    align: "right",
    cellClass: "text-right bbc-num",
    render: (row) => money(row.paid_amount),
  },
  {
    key: "recognized",
    header: "Признано",
    align: "right",
    cellClass: "text-right bbc-num",
    render: (row, mode) => {
      const recognized = (row.recognition[mode]?.alloc ?? []).reduce(
        (sum, entry) => sum + entry[3],
        0,
      );
      const wip = row.recognition[mode]?.wip ?? 0;
      if (recognized) {
        return <span style={{ color: "var(--accent-emerald)" }}>{money(recognized)}</span>;
      }
      if (wip) {
        return (
          <span style={{ color: "var(--accent-amber)" }} title="Ожидает: нет дат периода">
            {money(wip)} · WIP
          </span>
        );
      }
      return <span style={{ color: "var(--text-muted)" }}>—</span>;
    },
  },
  {
    key: "status",
    header: "Статус",
    optional: true,
    render: (row) => row.status || "—",
  },
];

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
