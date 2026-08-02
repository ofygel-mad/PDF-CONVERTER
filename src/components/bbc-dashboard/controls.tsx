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
import { useState, type CSSProperties } from "react";

import { ClockIcon, ControlPanelIcon, SlidersIcon } from "./icon";
import { Hint } from "./mobile/hint";
import { plural, relativeTime } from "./format";
import type { BbcDataset, BbcMode } from "./types";
import type { Filters } from "./use-dataset";
import { LivePulse } from "./live-pulse";
import type { LiveState } from "./use-live";

/* ── Live indicator ──────────────────────────────────────────────────────────── */

export function LiveIndicator({
  live,
  compact = false,
}: {
  live: LiveState;
  /** В однострочной шапке телефона — только трасса, без подписи. */
  compact?: boolean;
}) {
  // Три состояния, а не два. «Нет связи» — не отвечает наш бэкенд. «Источник не
  // читается» — бэкенд жив и честно отдаёт последние данные, но саму таблицу он
  // больше прочитать не может: сменились права сервис-аккаунта, переименовали
  // лист, кончилась квота. Раньше это выглядело как полный порядок — зелёная
  // точка и «правка 4 часа назад», хотя цифры молча застыли.
  const failing = live.online && !!live.sourceError;

  const label = !live.online
    ? "нет связи"
    : failing
      ? "таблица не читается"
      : live.changedAt
        ? `правка ${relativeTime(live.changedAt)}`
        : "следим за таблицей";

  const title = !live.online
    ? "Бэкенд не отвечает — показаны последние загруженные данные"
    : failing
      ? `Google Sheets не отвечает: ${live.sourceError}. Числа на экране — от ${
          live.fetchedAt ? relativeTime(live.fetchedAt) : "последнего удачного чтения"
        }, новее взять неоткуда.`
      : `Проверяем Google Sheets каждые 5 секунд${
          live.changedAt ? `. Последнее изменение: ${relativeTime(live.changedAt)}` : ""
        }`;

  return (
    <span
      className="flex items-center gap-1.5 mono-meta"
      title={title}
      style={failing ? { color: "var(--accent-rose)" } : undefined}
      role={failing ? "alert" : undefined}
    >
      <LivePulse live={live} compact={compact} />
      {/* Сбой источника нельзя прятать на узком экране — это единственное
          состояние, где цифрам на экране верить нельзя. В компактном виде
          подпись убрана даже для сбоя: на телефоне он выведен отдельной
          строкой-баннером под шапкой, где заметнее, а не мельче. Но трасса
          для скринридера — пустое место, поэтому состояние всё равно уходит
          текстом. */}
      {compact ? (
        <span className="sr-only">{label}</span>
      ) : (
        <span className={failing ? "" : "hidden sm:inline"}>{label}</span>
      )}
    </span>
  );
}

/**
 * Сбой источника на телефоне — отдельной строкой, а не подписью у индикатора.
 *
 * В однострочной шапке для текста места нет, но это единственное состояние, где
 * числам на экране верить нельзя, — и прятать его нельзя тем более. Строка под
 * шапкой даёт ему больше заметности, чем мелкая подпись, а не меньше.
 */
export function LiveFailureBanner({ live }: { live: LiveState }) {
  const failing = live.online && !!live.sourceError;
  if (!failing && live.online) return null;

  const text = !live.online
    ? "Нет связи с сервером — на экране последние загруженные данные."
    : `Google Sheets не отвечает: ${live.sourceError}. Числа — от ${
        live.fetchedAt ? relativeTime(live.fetchedAt) : "последнего удачного чтения"
      }, новее взять неоткуда.`;

  return (
    <div
      className={`sm:hidden px-4 py-2 text-xs ${live.online ? "banner-rose" : "banner-amber"}`}
      style={{ borderRadius: 0 }}
      role="alert"
    >
      {text}
    </div>
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

/**
 * Четыре переключателя режима — всегда развёрнуты.
 *
 * Раньше они прятались за «Настройки отчёта ▼» прямо над данными, где место
 * дорого. Теперь блок живёт в своей вкладке, прятать его больше не от кого, а
 * свёрнутый список настроек — это лишний клик до единственного места, где режим
 * вообще можно собрать вручную.
 */
export function ModeSwitches({
  dataset,
  mode,
  onMode,
}: {
  dataset: BbcDataset;
  mode: BbcMode;
  onMode: (mode: BbcMode) => void;
}) {
  const current = decompose(mode);

  return (
    <div className="flex flex-col gap-3">
      <p className="mono-meta" style={{ color: "var(--text-secondary)" }}>
        {dataset.mode_descriptions[mode]}
      </p>

      <div className="card-inner p-3 flex flex-col gap-3">
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
        <p className="bbc-micro mt-1.5" style={{ color: "var(--text-muted)" }}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/* ── Filters ─────────────────────────────────────────────────────────────────── */

export type FilterKey =
  | "months"
  | "firms"
  | "departments"
  | "employees"
  | "serviceKinds"
  | "statuses";

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
  alwaysOpen = false,
}: {
  dataset: BbcDataset;
  filters: Filters;
  onToggle: (key: FilterKey, value: string) => void;
  onSearch: (value: string) => void;
  onClear: () => void;
  activeCount: number;
  visibleRows: number;
  totalRows: number;
  /** В панели управления прятать фильтры не от кого — она и есть их место. */
  alwaysOpen?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const expanded = alwaysOpen || open;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        {/* На узком экране поиск занимает свою строку целиком: при min-w 180px
            он ужимался до «Поиск: клиен» и подсказка переставала читаться. */}
        <input
          className="input-field text-xs w-full sm:w-auto sm:flex-1 sm:min-w-[180px] sm:max-w-xs"
          placeholder="Поиск: клиент, договор, сотрудник…"
          value={filters.search}
          onChange={(event) => onSearch(event.target.value)}
          aria-label="Поиск по строкам"
        />
        {alwaysOpen ? null : (
          <button
            type="button"
            className="btn-ghost text-xs px-2.5 py-1.5"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
          >
            Фильтры{activeCount ? ` · ${activeCount}` : ""} {open ? "▲" : "▼"}
          </button>
        )}
        {activeCount ? (
          <button type="button" className="btn-ghost text-xs px-2.5 py-1.5" onClick={onClear}>
            Сбросить{alwaysOpen ? ` · ${activeCount}` : ""}
          </button>
        ) : null}
        <span className="mono-meta ml-auto">
          {visibleRows === totalRows ? `${totalRows} строк` : `${visibleRows} из ${totalRows}`}
        </span>
      </div>

      {expanded ? (
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
                        className="bbc-mini px-2 py-1 rounded-md max-w-[150px] truncate"
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

/* ── Context strip ───────────────────────────────────────────────────────────── */

/**
 * Строка-статус под навигацией.
 *
 * Панель управления уехала в свою вкладку, и данные поднялись почти на треть
 * экрана — но цифра без подписи опаснее, чем цифра, до которой надо доскроллить.
 * Поэтому от панели остаётся одна строка, которая всегда отвечает на вопрос
 * «что я сейчас вижу»: каким способом признан доход, какие фильтры стоят,
 * сколько строк осталось. Клик по любой её части ведёт в панель.
 */
export function ContextStrip({
  dataset,
  mode,
  filters,
  activeCount,
  visibleRows,
  totalRows,
  live,
  onOpen,
  onOpenSheet,
  onToggle,
  onClear,
  tone,
}: {
  dataset: BbcDataset;
  mode: BbcMode;
  filters: Filters;
  activeCount: number;
  visibleRows: number;
  totalRows: number;
  live: LiveState;
  /** Десктоп: уводит в раздел «Панель управления». */
  onOpen: () => void;
  /** Телефон: открывает лист управления, не покидая раздел с данными. */
  onOpenSheet?: () => void;
  onToggle: (key: FilterKey, value: string) => void;
  onClear: () => void;
  /** Цвет отдела, когда дашборд открыт по реферальной ссылке. */
  tone?: string;
}) {
  const preset = Object.values(dataset.presets).find((item) => item.mode === mode);
  const accent = tone ?? "var(--accent)";

  const chips: Array<{ key: FilterKey; group: string; value: string }> = [];
  for (const group of FILTER_GROUPS) {
    for (const value of filters[group.key]) {
      chips.push({ key: group.key, group: group.title, value });
    }
  }

  const rowsLabel =
    visibleRows === totalRows
      ? `${totalRows} ${plural(totalRows, "строка", "строки", "строк")}`
      : `${visibleRows} из ${totalRows}`;

  return (
    <>
    {/* Телефон: одна строка вместо ленты чипов с прокруткой вбок.
        Листать вбок под шапкой, которую только что ужали до 48px, — ровно то,
        чего на телефоне позволить себе нельзя. Весь смысл ленты («что я сейчас
        вижу») умещается в одну строку, а снять фильтр можно в листе, который
        она открывает. */}
    <button
      type="button"
      onClick={onOpenSheet ?? onOpen}
      aria-haspopup={onOpenSheet ? "dialog" : undefined}
      className="bbc-context-strip sm:hidden w-full flex items-center gap-2 px-4 py-2 border-b text-left"
      style={
        {
          background: "var(--bg-raised)",
          borderColor: "var(--border-subtle)",
          minHeight: "var(--ios-tap)",
        } as CSSProperties
      }
    >
      <span aria-hidden="true" className="shrink-0" style={{ color: accent }}>
        ◆
      </span>
      <span className="flex-1 min-w-0 truncate text-xs" style={{ color: "var(--text-primary)" }}>
        {preset?.title ?? "Свой режим"}
        <span style={{ color: "var(--text-muted)" }}>
          {" · "}
          {rowsLabel}
          {activeCount ? ` · фильтры ${activeCount}` : ""}
        </span>
      </span>
      {live.sourceError ? (
        <span className="mono-meta shrink-0" style={{ color: "var(--accent-rose)" }}>
          старые данные
        </span>
      ) : null}
      <span className="shrink-0" style={{ color: "var(--text-muted)" }} aria-hidden="true">
        <SlidersIcon size={16} />
      </span>
    </button>

    <div
      className="bbc-context-strip bbc-enter hidden sm:flex items-center gap-2 px-4 py-1.5 border-b overflow-x-auto scrollbar-hidden"
      style={
        {
          background: "var(--bg-raised)",
          borderColor: "var(--border-subtle)",
          "--enter-index": 2,
        } as CSSProperties
      }
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex items-center gap-1.5 shrink-0 text-xs"
        title="Открыть панель управления"
      >
        <span aria-hidden="true" style={{ color: accent }}>
          ◆
        </span>
        <span style={{ color: "var(--text-primary)" }}>{preset?.title ?? "Свой режим"}</span>
      </button>

      <span className="mono-meta shrink-0 hidden md:inline" style={{ color: "var(--text-muted)" }}>
        {dataset.mode_descriptions[mode]}
      </span>

      {chips.length ? (
        <span className="mono-meta shrink-0" aria-hidden="true" style={{ color: "var(--text-muted)" }}>
          ·
        </span>
      ) : null}

      {chips.slice(0, 6).map((chip) => (
        <button
          key={`${chip.key}:${chip.value}`}
          type="button"
          onClick={() => onToggle(chip.key, chip.value)}
          className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full bbc-micro max-w-[170px]"
          style={{
            background: "var(--accent-soft)",
            color: "var(--text-accent)",
            border: "1px solid var(--accent-line)",
          }}
          title={`${chip.group}: ${chip.value} — снять фильтр`}
        >
          <span className="truncate">{chip.value}</span>
          <span aria-hidden="true" style={{ opacity: 0.7 }}>
            ✕
          </span>
        </button>
      ))}

      {chips.length > 6 ? (
        <span className="mono-meta shrink-0">+{chips.length - 6}</span>
      ) : null}

      {activeCount ? (
        <button
          type="button"
          onClick={onClear}
          className="mono-meta shrink-0"
          style={{ color: "var(--text-muted)" }}
        >
          сбросить
        </button>
      ) : null}

      <span className="flex-1" />

      {/* Возраст данных показываем только когда он перестал быть подробностью:
          источник не читается, и на экране заведомо не последняя правда. */}
      {live.sourceError ? (
        <span className="mono-meta shrink-0" style={{ color: "var(--accent-rose)" }}>
          данные от {live.fetchedAt ? relativeTime(live.fetchedAt) : "прошлого чтения"}
        </span>
      ) : null}

      <span className="mono-meta shrink-0">{rowsLabel}</span>

      <button
        type="button"
        onClick={onOpen}
        className="btn-ghost shrink-0 text-xs px-2 py-1 flex items-center gap-1.5"
        style={{ minHeight: 0 }}
        title="Панель управления: режим, фильтры, виды"
      >
        <ControlPanelIcon size={13} />
        <span className="hidden lg:inline">Настроить</span>
      </button>
    </div>
    </>
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

  // Пояснение к покрытию — через Hint: раньше оно жило в `title`, а именно
  // здесь объясняется, насколько числу вообще можно верить.
  const chip = (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bbc-micro"
      style={{ background: "var(--bg-active)", color: "var(--text-secondary)" }}
    >
      <span aria-hidden="true" style={{ width: 5, height: 5, borderRadius: "50%", background: tone }} />
      {label}
      <span className="bbc-num" style={{ color: tone }}>
        {Math.round(share * 100)}%
      </span>
    </span>
  );

  return hint ? <Hint text={hint} label={`Что входит в «${label}»`}>{chip}</Hint> : chip;
}

/** Marks a figure that rests on a fallback rather than real data. */
export function EstimateBadge({ reason }: { reason: string }) {
  return (
    <Hint text={reason} label="Почему это оценка">
      <span
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bbc-micro"
        style={{ background: "var(--bg-active)", color: "var(--accent-amber)" }}
      >
        <ClockIcon size={10} />
        оценка
      </span>
    </Hint>
  );
}
