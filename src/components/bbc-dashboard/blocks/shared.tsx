"use client";

/** Pieces shared by every block: cards, KPI tiles, the row table, empty states. */
import { useMemo, type ReactNode } from "react";

import { useCountUp } from "../use-count-up";
import { useChangedKeys } from "../use-live";

import { dateLabel, money, moneyShort, percent } from "../format";
import { SpecList, type FieldSpec } from "../mobile/card-list";
import { Hint } from "../mobile/hint";
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
      {/* Точное значение. В плитке число сокращено до «189 млн», а полное
          лежало только в `title` — то есть с телефона было недостижимо.
          Показывается там же, где `title` не работает; CSS решает где. */}
      <p className="bbc-kpi-exact bbc-num" style={{ color: "var(--text-muted)" }}>
        {exact}
      </p>
    </div>
  );
}

/** The escape hatch: full row detail, so no data is ever hidden from the user. */
export function RowTable({
  rows,
  mode,
  limit = 60,
}: {
  rows: BbcRow[];
  mode: BbcMode;
  limit?: number;
}) {
  return (
    <SpecList
      columns={COLUMNS}
      rows={rows}
      ctx={mode}
      rowKey={(row) => row.index}
      limit={limit}
    />
  );
}

/**
 * Колонки реестра, описанные один раз.
 *
 * `optional` — то, без чего строку всё ещё можно прочитать. На десктопе в
 * компактном режиме эти колонки уходят, и на экран влезает вдвое больше строк;
 * на телефоне они прячутся под раскрытие в карточке. Договор, оплата и
 * признание не помечены никогда — ради них таблицу и открывают.
 *
 * `primary`/`secondary` нужны только карточке: из чего собрать её заголовок и
 * подпись под ним. На таблицу они не влияют.
 */
type RowColumn = FieldSpec<BbcRow, BbcMode>;

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
    primary: true,
    cellClass: "max-w-[220px] truncate",
    tone: "var(--text-primary)",
    hint: (row) => row.client || undefined,
    render: (row) => row.client || "—",
  },
  {
    key: "departments",
    header: "Отдел",
    optional: true,
    secondary: true,
    render: (row) => row.departments.join(", ") || "—",
  },
  {
    key: "service",
    header: "Услуга",
    optional: true,
    secondary: true,
    render: (row) => row.service_kind || "—",
  },
  {
    key: "period",
    header: "Период",
    secondary: true,
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
        // Причина, по которой сумма ещё не признана, раньше лежала в `title` —
        // то есть на телефоне была недостижима.
        return (
          <Hint text="Ожидает: нет дат периода">
            <span style={{ color: "var(--accent-amber)" }}>{money(wip)} · WIP</span>
          </Hint>
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
