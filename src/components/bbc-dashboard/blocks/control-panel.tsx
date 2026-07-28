"use client";

/**
 * Панель управления — отдельный раздел, а не полоса над данными.
 *
 * Раньше всё это висело над каждым блоком и занимало верхнюю треть экрана:
 * данные начинались там, где уже надо было скроллить. Хуже того, три кнопки
 * пресетов выглядели неисправными — на «Дебиторке», которая открывается первой,
 * вариант признания не меняет ни одной цифры, потому что этот блок живёт на
 * фактах документов (счёт выставлен, акт подписан, деньги пришли), а не на
 * признанной выручке.
 *
 * Поэтому пресет здесь — не кнопка, а карточка, которая заранее показывает свои
 * последствия: сколько выручки признаётся, сколько повисает «на исполнении» и
 * как выглядит профиль месяцев. Всё считается на клиенте из готовых раскладок
 * `recognition`, без единого запроса. Плюс прямым текстом сказано, на какие
 * разделы вариант признания влияет, а на какие нет.
 */
import { useMemo, useState } from "react";

import { Sparkline } from "../charts";
import { FilterBar, ModeSwitches } from "../controls";
import type { FilterKey } from "../controls";
import { money, moneyShort, monthShort } from "../format";
import { ArrowRightIcon, ControlPanelIcon } from "../icon";
import type { SavedView } from "../saved-views";
import type { BbcDataset, BbcMode, BbcRow } from "../types";
import { byMonthCycle, monthAxis, recognizedTotal, wipTotal } from "../use-dataset";
import type { Filters } from "../use-dataset";
import { SectionCard } from "./shared";

/**
 * На какие разделы влияет вариант признания.
 *
 * Список существует ровно потому, что его отсутствие и породило жалобу на
 * «мёртвые кнопки». Молчание тут читается как поломка.
 */
const AFFECTED: Array<{ key: string; title: string; affected: boolean; why: string }> = [
  {
    key: "reports",
    title: "Отчёты",
    affected: true,
    why: "ОПиУ и профиль месяцев считаются из признанной выручки",
  },
  {
    key: "analytics",
    title: "Аналитика",
    affected: true,
    why: "структура выручки и разрезы — по признанию",
  },
  {
    key: "receivables",
    title: "Дебиторка",
    affected: false,
    why: "живёт на фактах документов: счёт, акт, оплата",
  },
  { key: "journal", title: "Журнал", affected: false, why: "движение денег, признание тут ни при чём" },
  { key: "calendar", title: "Календарь", affected: false, why: "у него свой метод прогноза платежей" },
  { key: "sales", title: "Продажи", affected: false, why: "план и факт из таблицы ОМиП" },
];

export function ControlPanelBlock({
  dataset,
  rows,
  mode,
  onMode,
  filters,
  onToggleFilter,
  onSearch,
  onClearFilters,
  activeFilterCount,
  views,
  onSaveView,
  onApplyView,
  onRemoveView,
  onBack,
  backTitle,
  restricted = false,
  tone,
}: {
  dataset: BbcDataset;
  rows: BbcRow[];
  mode: BbcMode;
  onMode: (mode: BbcMode) => void;
  filters: Filters;
  onToggleFilter: (key: FilterKey, value: string) => void;
  onSearch: (value: string) => void;
  onClearFilters: () => void;
  activeFilterCount: number;
  views: SavedView[];
  onSaveView: (name: string) => void;
  onApplyView: (view: SavedView) => void;
  onRemoveView: (id: string) => void;
  onBack: () => void;
  backTitle: string;
  /** Доступ по ссылке отдела: служебные разрезы админа сюда не выносим. */
  restricted?: boolean;
  tone?: string;
}) {
  // Руководителю отдела нет смысла рассказывать про «Отчёты» и «Продажи»:
  // этих разделов у него нет, и список выглядел бы как обещание того, чего
  // он не увидит.
  const affected = useMemo(() => {
    const granted = new Set(dataset.scope.blocks);
    if (granted.has("*")) return AFFECTED;
    return AFFECTED.filter((item) => granted.has(item.key));
  }, [dataset.scope.blocks]);

  const axis = useMemo(() => monthAxis(rows), [rows]);
  const activeTotal = useMemo(() => recognizedTotal(rows, mode), [rows, mode]);

  const presets = useMemo(
    () =>
      Object.entries(dataset.presets).map(([key, preset]) => ({
        key,
        title: preset.title,
        mode: preset.mode,
        description: dataset.mode_descriptions[preset.mode],
        recognized: recognizedTotal(rows, preset.mode),
        wip: wipTotal(rows, preset.mode),
        months: byMonthCycle(rows, preset.mode, axis),
      })),
    [dataset, rows, axis],
  );

  return (
    <div className="flex flex-col gap-4">
      <SectionCard
        title="Вариант признания"
        subtitle="Числа под каждым пресетом посчитаны по текущей выборке — видно заранее, что он даст."
        action={
          <button
            type="button"
            className="btn-ghost text-xs px-2.5 py-1.5 flex items-center gap-1.5"
            onClick={onBack}
          >
            К разделу «{backTitle}»
            <ArrowRightIcon size={14} />
          </button>
        }
      >
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {presets.map((preset, index) => (
            <PresetCard
              key={preset.key}
              title={preset.title}
              description={preset.description}
              recognized={preset.recognized}
              delta={preset.recognized - activeTotal}
              wip={preset.wip}
              months={preset.months}
              active={preset.mode === mode}
              index={index}
              tone={tone}
              onPick={() => onMode(preset.mode)}
            />
          ))}
        </div>

        <div className="mt-4">
          <p className="eyebrow mb-2">На что влияет выбор</p>
          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {affected.map((item) => (
              <div
                key={item.title}
                className="flex items-baseline gap-2 text-xs px-2.5 py-1.5 rounded-lg"
                style={{ background: "var(--bg-active)" }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    color: item.affected ? "var(--accent-emerald)" : "var(--text-muted)",
                  }}
                >
                  {item.affected ? "●" : "○"}
                </span>
                <span style={{ color: "var(--text-primary)" }}>{item.title}</span>
                <span className="truncate" style={{ color: "var(--text-muted)" }} title={item.why}>
                  {item.why}
                </span>
              </div>
            ))}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Настройки отчёта"
        subtitle="Ручная сборка режима, если ни один пресет не подходит."
      >
        <ModeSwitches dataset={dataset} mode={mode} onMode={onMode} />
      </SectionCard>

      <SectionCard
        title="Фильтры"
        subtitle="Применяются сразу ко всем разделам и живут в адресе страницы — ссылкой можно поделиться."
      >
        <FilterBar
          dataset={dataset}
          filters={filters}
          onToggle={onToggleFilter}
          onSearch={onSearch}
          onClear={onClearFilters}
          activeCount={activeFilterCount}
          visibleRows={rows.length}
          totalRows={dataset.rows.length}
          alwaysOpen
        />
      </SectionCard>

      {restricted ? null : (
        <SectionCard
          title="Сохранённые виды"
          subtitle="Связка «раздел + режим + фильтры» под своим именем. Хранится в этом браузере."
        >
          <SavedViews
            views={views}
            onApply={onApplyView}
            onRemove={onRemoveView}
            onSave={onSaveView}
          />
        </SectionCard>
      )}
    </div>
  );
}

/* ── Карточка пресета ────────────────────────────────────────────────────────── */

function PresetCard({
  title,
  description,
  recognized,
  delta,
  wip,
  months,
  active,
  index,
  tone,
  onPick,
}: {
  title: string;
  description: string;
  recognized: number;
  delta: number;
  wip: number;
  months: Array<{ month: string; total: number }>;
  active: boolean;
  index: number;
  tone?: string;
  onPick: () => void;
}) {
  const accent = tone ?? "var(--accent)";
  // Месяц, на который пресет ставит максимум — самое короткое объяснение, чем
  // один вариант отличается от другого: «по актам» и «по периодам» называют
  // лучшим месяцем разные месяцы.
  const peak = months.reduce<{ month: string; total: number } | null>(
    (best, item) => (best === null || item.total > best.total ? item : best),
    null,
  );

  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={active}
      className="card p-3 text-left flex flex-col gap-2 bbc-tile animate-fade-in"
      style={{
        borderColor: active ? accent : "var(--border-base)",
        background: active ? "var(--accent-soft)" : undefined,
        animationDelay: `calc(${index} * var(--dur-stagger))`,
        animationFillMode: "backwards",
      }}
      title={description}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className="text-sm font-semibold"
          style={{ color: active ? "var(--text-accent)" : "var(--text-primary)" }}
        >
          {title}
        </span>
        {active ? (
          <span className="mono-meta" style={{ color: accent }}>
            применён
          </span>
        ) : null}
      </div>

      <p className="text-[0.68rem] leading-snug" style={{ color: "var(--text-muted)" }}>
        {description}
      </p>

      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-lg font-semibold bbc-num" style={{ color: "var(--text-primary)" }}>
            {moneyShort(recognized)}
          </p>
          <p className="mono-meta" title={`${money(recognized)} ₸ признанной выручки`}>
            признано
            {active || delta === 0 ? null : (
              <span style={{ color: delta > 0 ? "var(--accent-emerald)" : "var(--accent-rose)" }}>
                {" "}
                {delta > 0 ? "+" : "−"}
                {moneyShort(Math.abs(delta))}
              </span>
            )}
          </p>
        </div>
        {/* Неактивный вариант рисуется приглушённо: emerald в этой системе
            означает приток денег, а не «другой пресет». */}
        <Sparkline
          values={months.map((item) => item.total)}
          width={84}
          height={26}
          tone={active ? "accent" : "muted"}
        />
      </div>

      <div className="flex items-center gap-3 mono-meta">
        {peak && peak.total > 0 ? <span>пик {monthShort(peak.month)}</span> : null}
        {wip > 0 ? (
          <span style={{ color: "var(--accent-amber)" }} title={`${money(wip)} ₸ ещё не разнесено`}>
            на исполнении {moneyShort(wip)}
          </span>
        ) : null}
      </div>
    </button>
  );
}

/* ── Сохранённые виды ────────────────────────────────────────────────────────── */

function SavedViews({
  views,
  onApply,
  onRemove,
  onSave,
}: {
  views: SavedView[];
  onApply: (view: SavedView) => void;
  onRemove: (id: string) => void;
  onSave: (name: string) => void;
}) {
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");

  return (
    <div className="flex items-center gap-1.5 flex-wrap bbc-no-print">
      {views.length === 0 && !naming ? (
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          Пока ни одного вида.
        </span>
      ) : null}

      {views.map((view) => (
        <span
          key={view.id}
          className="flex items-center gap-1 text-[0.7rem] rounded-lg"
          style={{ background: "var(--bg-active)", color: "var(--text-secondary)" }}
        >
          <button
            type="button"
            className="pl-2.5 py-1"
            onClick={() => onApply(view)}
            title={`${view.block} · ${view.mode}`}
          >
            {view.name}
          </button>
          <button
            type="button"
            className="pr-2 py-1"
            onClick={() => onRemove(view.id)}
            aria-label={`Удалить вид «${view.name}»`}
            style={{ color: "var(--text-muted)" }}
          >
            ✕
          </button>
        </span>
      ))}

      {naming ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSave(name);
            setName("");
            setNaming(false);
          }}
          className="flex items-center gap-1.5"
        >
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            onBlur={() => setNaming(false)}
            placeholder="Название вида"
            className="input-field text-xs max-w-[160px]"
            aria-label="Название сохранённого вида"
          />
          <button type="submit" className="btn-ghost text-xs px-2 py-1">
            Сохранить
          </button>
        </form>
      ) : (
        <button
          type="button"
          className="btn-ghost text-[0.7rem] px-2.5 py-1 flex items-center gap-1.5"
          onClick={() => setNaming(true)}
          title="Сохранить текущие фильтры и режим"
        >
          <ControlPanelIcon size={12} />
          Сохранить текущий вид
        </button>
      )}
    </div>
  );
}
