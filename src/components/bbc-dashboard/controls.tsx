"use client";

/**
 * The control strip that sits above every block: presets, the four mode
 * switches, filters and the live indicator.
 *
 * The mode switches produce nine meaningful combinations, which is more than
 * anyone should hold in their head — so presets carry business names and a
 * permanent plain-Russian line spells out the current combination. The user can
 * always read which number they are looking at.
 */
import { useState } from "react";

import { ClockIcon } from "./icon";
import { relativeTime } from "./format";
import type { BbcDataset, BbcMode } from "./types";
import type { Filters } from "./use-dataset";
import type { LiveState } from "./use-live";

/* ── Live indicator ──────────────────────────────────────────────────────────── */

export function LiveIndicator({ live }: { live: LiveState }) {
  const tone = live.online ? "var(--accent-emerald)" : "var(--accent-amber)";

  return (
    <span className="flex items-center gap-1.5 mono-meta" title="Данные обновляются автоматически">
      <span
        aria-hidden="true"
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: tone,
          boxShadow: live.online ? `0 0 0 3px color-mix(in srgb, ${tone} 22%, transparent)` : "none",
        }}
      />
      <span className="hidden sm:inline">
        {live.online ? relativeTime(live.changedAt) : "нет связи"}
      </span>
    </span>
  );
}

/* ── Presets + mode switches ─────────────────────────────────────────────────── */

const CYCLE_OPTIONS = [
  { key: "prorata", label: "Пропорционально дням" },
  { key: "start", label: "Целиком по дате начала" },
];

const ONE_OFF_OPTIONS = [
  { key: "wip", label: "Подвесить до завершения" },
  { key: "prepay", label: "По месяцу предоплаты" },
];

/** Splits a mode key into the four switch positions. */
function decompose(mode: BbcMode) {
  if (mode === "v1:avrdate") {
    return { variant: "v1" as const, allocation: "avrdate" as const, cycle: "prorata", oneOff: "wip" };
  }
  const parts = mode.split(":");
  if (parts[0] === "v2") {
    return { variant: "v2" as const, allocation: "period" as const, cycle: parts[1], oneOff: parts[2] };
  }
  return { variant: "v1" as const, allocation: "period" as const, cycle: parts[2], oneOff: parts[3] };
}

function compose(variant: "v1" | "v2", allocation: "period" | "avrdate", cycle: string, oneOff: string): BbcMode {
  if (variant === "v1" && allocation === "avrdate") return "v1:avrdate";
  if (variant === "v2") return `v2:${cycle}:${oneOff}` as BbcMode;
  return `v1:period:${cycle}:${oneOff}` as BbcMode;
}

export function ModeControls({
  dataset,
  mode,
  onMode,
}: {
  dataset: BbcDataset;
  mode: BbcMode;
  onMode: (mode: BbcMode) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = decompose(mode);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5 flex-wrap">
        {Object.entries(dataset.presets).map(([key, preset]) => (
          <button
            key={key}
            type="button"
            onClick={() => onMode(preset.mode)}
            className={mode === preset.mode ? "btn-primary text-xs px-3 py-1.5" : "btn-ghost text-xs px-3 py-1.5"}
          >
            {preset.title}
          </button>
        ))}
        <button
          type="button"
          className="btn-ghost text-xs px-2.5 py-1.5"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
        >
          Настройки отчёта {open ? "▲" : "▼"}
        </button>
      </div>

      {/* Always visible: what the current combination actually means. */}
      <p className="mono-meta" style={{ color: "var(--text-secondary)" }}>
        {dataset.mode_descriptions[mode]}
      </p>

      {open ? (
        <div
          className="card-inner p-3 flex flex-col gap-3 animate-fade-in"
          style={{ animationDuration: "var(--dur-base)" }}
        >
          <SwitchRow
            title="Вариант признания"
            options={[
              { key: "v2", label: "По периодам услуг" },
              { key: "v1", label: "По документам (АВР)" },
            ]}
            value={current.variant}
            onChange={(value) =>
              onMode(compose(value as "v1" | "v2", current.allocation, current.cycle, current.oneOff))
            }
          />

          {current.variant === "v1" ? (
            <SwitchRow
              title="Аллокация по документам"
              hint="У 76% строк акт подписан не в месяце оказания услуги, поэтому выбор заметно меняет картину месяцев."
              options={[
                { key: "period", label: "По периоду услуги" },
                { key: "avrdate", label: "По дате акта" },
              ]}
              value={current.allocation}
              onChange={(value) =>
                onMode(compose("v1", value as "period" | "avrdate", current.cycle, current.oneOff))
              }
            />
          ) : null}

          {current.allocation === "period" ? (
            <>
              <SwitchRow
                title="Циклы абонентки"
                options={CYCLE_OPTIONS}
                value={current.cycle}
                onChange={(value) =>
                  onMode(compose(current.variant, current.allocation, value, current.oneOff))
                }
              />
              <SwitchRow
                title="Разовые услуги"
                options={ONE_OFF_OPTIONS}
                value={current.oneOff}
                onChange={(value) =>
                  onMode(compose(current.variant, current.allocation, current.cycle, value))
                }
              />
            </>
          ) : (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Акт — точечное событие, поэтому раскладка по циклам и правило разовых услуг в этом
              режиме не применяются.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function SwitchRow({
  title,
  hint,
  options,
  value,
  onChange,
}: {
  title: string;
  hint?: string;
  options: Array<{ key: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <p className="eyebrow mb-1.5">{title}</p>
      <div className="flex gap-1.5 flex-wrap">
        {options.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => onChange(option.key)}
            className="text-xs px-2.5 py-1.5 rounded-lg"
            style={{
              background: value === option.key ? "var(--accent-soft)" : "var(--bg-active)",
              border: `1px solid ${value === option.key ? "var(--accent-line)" : "var(--border-subtle)"}`,
              color: value === option.key ? "var(--text-accent)" : "var(--text-secondary)",
              transition: "background var(--dur-fast), border-color var(--dur-fast)",
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
      {hint ? (
        <p className="text-[0.68rem] mt-1.5" style={{ color: "var(--text-muted)" }}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/* ── Filters ─────────────────────────────────────────────────────────────────── */

type FilterKey = "months" | "firms" | "departments" | "employees" | "serviceKinds" | "statuses";

const FILTER_GROUPS: Array<{ key: FilterKey; title: string; source: keyof BbcDataset["dimensions"] }> = [
  { key: "months", title: "Месяц", source: "months" },
  { key: "firms", title: "Фирма", source: "firms" },
  { key: "departments", title: "Отдел", source: "departments" },
  { key: "serviceKinds", title: "Вид услуги", source: "service_kinds" },
  { key: "employees", title: "Сотрудник", source: "employees" },
  { key: "statuses", title: "Статус", source: "statuses" },
];

export function FilterBar({
  dataset,
  filters,
  onToggle,
  onSearch,
  onClear,
  activeCount,
  visibleRows,
  totalRows,
}: {
  dataset: BbcDataset;
  filters: Filters;
  onToggle: (key: FilterKey, value: string) => void;
  onSearch: (value: string) => void;
  onClear: () => void;
  activeCount: number;
  visibleRows: number;
  totalRows: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <input
          className="input-field text-xs flex-1 min-w-[180px] max-w-xs"
          placeholder="Поиск: клиент, договор, сотрудник…"
          value={filters.search}
          onChange={(event) => onSearch(event.target.value)}
          aria-label="Поиск по строкам"
        />
        <button
          type="button"
          className="btn-ghost text-xs px-2.5 py-1.5"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
        >
          Фильтры{activeCount ? ` · ${activeCount}` : ""} {open ? "▲" : "▼"}
        </button>
        {activeCount ? (
          <button type="button" className="btn-ghost text-xs px-2.5 py-1.5" onClick={onClear}>
            Сбросить
          </button>
        ) : null}
        <span className="mono-meta ml-auto">
          {visibleRows === totalRows ? `${totalRows} строк` : `${visibleRows} из ${totalRows}`}
        </span>
      </div>

      {open ? (
        <div
          className="card-inner p-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 animate-fade-in"
          style={{ animationDuration: "var(--dur-base)" }}
        >
          {FILTER_GROUPS.map((group) => {
            const values = dataset.dimensions[group.source] as string[];
            if (!values?.length) return null;
            return (
              <div key={group.key}>
                <p className="eyebrow mb-1.5">{group.title}</p>
                <div className="flex flex-wrap gap-1">
                  {values.slice(0, 24).map((value) => {
                    const active = filters[group.key].includes(value);
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => onToggle(group.key, value)}
                        className="text-[0.7rem] px-2 py-1 rounded-md max-w-[150px] truncate"
                        style={{
                          background: active ? "var(--accent-soft)" : "var(--bg-active)",
                          border: `1px solid ${active ? "var(--accent-line)" : "transparent"}`,
                          color: active ? "var(--text-accent)" : "var(--text-secondary)",
                          transition: "background var(--dur-fast)",
                        }}
                        title={value}
                      >
                        {value}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/* ── Coverage chip ───────────────────────────────────────────────────────────── */

/**
 * Says how complete the data behind a number is. The dashboard must never look
 * more trustworthy than its source.
 */
export function CoverageChip({
  label,
  share,
  hint,
}: {
  label: string;
  share: number;
  hint?: string;
}) {
  const tone =
    share >= 0.9 ? "var(--accent-emerald)" : share >= 0.5 ? "var(--accent-amber)" : "var(--accent-rose)";

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[0.68rem]"
      style={{ background: "var(--bg-active)", color: "var(--text-secondary)" }}
      title={hint}
    >
      <span aria-hidden="true" style={{ width: 5, height: 5, borderRadius: "50%", background: tone }} />
      {label}
      <span className="bbc-num" style={{ color: tone }}>
        {Math.round(share * 100)}%
      </span>
    </span>
  );
}

/** Marks a figure that rests on a fallback rather than real data. */
export function EstimateBadge({ reason }: { reason: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[0.62rem]"
      style={{ background: "var(--bg-active)", color: "var(--accent-amber)" }}
      title={reason}
    >
      <ClockIcon size={10} />
      оценка
    </span>
  );
}
