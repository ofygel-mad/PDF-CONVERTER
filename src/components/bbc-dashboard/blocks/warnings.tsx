"use client";

/**
 * Блок 7 — Предупреждения.
 *
 * The source is a living spreadsheet: always partly filled, always changing,
 * always exposed to human slips. This block is where the service earns its keep
 * as a layer between the data and the people — it points at contradictions and
 * says what to fix, with the sheet row numbers and the money at stake.
 *
 * Nothing is corrected automatically. The service points; the human decides.
 */
import { useMemo, useState } from "react";

import { money, plural } from "../format";
import { WarningIcon } from "../icon";
import type { BbcCoverage, BbcRow, BbcSeverity, BbcWarning, BbcWarningsSummary } from "../types";
import { SectionCard } from "./shared";

const SEVERITY: Record<BbcSeverity, { label: string; colour: string; order: number }> = {
  critical: { label: "Критично", colour: "var(--accent-rose)", order: 0 },
  important: { label: "Важно", colour: "var(--accent-amber)", order: 1 },
  info: { label: "Информация", colour: "var(--text-muted)", order: 2 },
};

export function WarningsBlock({
  warnings,
  summary,
  coverage,
  rows,
}: {
  warnings: BbcWarning[];
  summary: BbcWarningsSummary;
  coverage: BbcCoverage;
  rows: BbcRow[];
}) {
  const [filter, setFilter] = useState<BbcSeverity | "all">("all");

  const visible = useMemo(
    () => (filter === "all" ? warnings : warnings.filter((item) => item.severity === filter)),
    [warnings, filter],
  );

  const clientOf = useMemo(() => {
    const map = new Map<number, string>();
    for (const row of rows) map.set(row.index, row.client);
    return map;
  }, [rows]);

  if (!warnings.length) {
    return (
      <SectionCard title="Предупреждения" subtitle="Аномалий в текущем срезе не найдено.">
        <p className="text-xs" style={{ color: "var(--accent-emerald)" }}>
          Данные согласованы: периоды заполнены, дубли не найдены, оплаты и акты сходятся.
        </p>
      </SectionCard>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionCard
        title="Состояние данных"
        subtitle="Сервис не только читает таблицу, но и подсвечивает её противоречия — исправлять их человеку, в источнике."
      >
        <div className="grid gap-2.5 grid-cols-2 sm:grid-cols-4">
          <Stat label="Всего" value={summary.total} />
          <Stat label="Критично" value={summary.critical} colour={SEVERITY.critical.colour} />
          <Stat label="Строк затронуто" value={summary.rows_affected} />
          <Stat label="Денег под риском" value={money(summary.amount_at_risk)} />
        </div>

        <div className="flex flex-wrap gap-3 mt-4">
          <Coverage label="Период начала заполнен" share={coverage.with_period_start} />
          <Coverage label="Отдел проставлен" share={coverage.with_department} />
          <Coverage label="Сумма договора есть" share={coverage.with_contract_amount} />
          <Coverage label="Акт подписан" share={coverage.avr_signed} />
        </div>
      </SectionCard>

      <div className="flex items-center gap-1.5 flex-wrap">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
          Все · {warnings.length}
        </FilterChip>
        {(Object.keys(SEVERITY) as BbcSeverity[]).map((severity) => {
          const count = warnings.filter((item) => item.severity === severity).length;
          if (!count) return null;
          return (
            <FilterChip
              key={severity}
              active={filter === severity}
              onClick={() => setFilter(severity)}
              colour={SEVERITY[severity].colour}
            >
              {SEVERITY[severity].label} · {count}
            </FilterChip>
          );
        })}
      </div>

      {visible.map((warning, index) => (
        <WarningCard key={warning.code} warning={warning} index={index} clientOf={clientOf} />
      ))}
    </div>
  );
}

function WarningCard({
  warning,
  index,
  clientOf,
}: {
  warning: BbcWarning;
  index: number;
  clientOf: Map<number, string>;
}) {
  const [open, setOpen] = useState(false);
  const severity = SEVERITY[warning.severity];

  return (
    <section
      className="card p-4 animate-fade-in"
      style={{
        animationDuration: "var(--dur-base)",
        animationDelay: `calc(${Math.min(index, 12)} * var(--dur-stagger))`,
        animationFillMode: "backwards",
        borderLeft: `2px solid ${severity.colour}`,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <span style={{ color: severity.colour, marginTop: 2 }}>
            <WarningIcon size={15} />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                {warning.title}
              </h3>
              <span
                className="text-[0.62rem] px-1.5 py-0.5 rounded"
                style={{ background: "var(--bg-active)", color: severity.colour }}
              >
                {severity.label}
              </span>
            </div>
            <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
              {warning.detail}
            </p>
            <p className="text-xs mt-1.5" style={{ color: "var(--text-accent)" }}>
              → {warning.hint}
            </p>
          </div>
        </div>

        <div className="text-right shrink-0">
          <p className="text-sm font-semibold bbc-num" style={{ color: "var(--text-primary)" }}>
            {money(warning.amount)}
          </p>
          <p className="mono-meta">
            {warning.count} {plural(warning.count, "строка", "строки", "строк")}
          </p>
        </div>
      </div>

      <button
        type="button"
        className="btn-ghost text-xs px-2.5 py-1 mt-3"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        {open ? "Скрыть строки" : "Показать строки"}
      </button>

      {open ? (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {warning.rows.map((rowIndex) => (
            <span
              key={rowIndex}
              className="mono-meta px-2 py-1 rounded"
              style={{ background: "var(--bg-active)" }}
              title={clientOf.get(rowIndex) ?? undefined}
            >
              {rowIndex}
              {clientOf.get(rowIndex) ? ` · ${clientOf.get(rowIndex)}` : ""}
            </span>
          ))}
          {warning.truncated ? (
            <span className="mono-meta px-2 py-1">…и ещё {warning.count - warning.rows.length}</span>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function Stat({ label, value, colour }: { label: string; value: number | string; colour?: string }) {
  return (
    <div className="card-inner p-3">
      <p className="eyebrow mb-1">{label}</p>
      <p className="text-base font-semibold bbc-num" style={{ color: colour ?? "var(--text-primary)" }}>
        {value}
      </p>
    </div>
  );
}

function Coverage({ label, share }: { label: string; share: number }) {
  const tone =
    share >= 0.9 ? "var(--accent-emerald)" : share >= 0.5 ? "var(--accent-amber)" : "var(--accent-rose)";
  return (
    <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
      <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: tone }} />
      {label}
      <span className="bbc-num" style={{ color: tone }}>
        {Math.round(share * 100)}%
      </span>
    </span>
  );
}

function FilterChip({
  active,
  colour,
  onClick,
  children,
}: {
  active: boolean;
  colour?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-xs px-2.5 py-1.5 rounded-lg"
      style={{
        background: active ? "var(--accent-soft)" : "var(--bg-active)",
        border: `1px solid ${active ? "var(--accent-line)" : "transparent"}`,
        color: active ? "var(--text-accent)" : colour ?? "var(--text-secondary)",
        transition: "background var(--dur-fast)",
      }}
    >
      {children}
    </button>
  );
}
