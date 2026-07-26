"use client";

/**
 * BBC Dashboard — the shell.
 *
 * Holds the three things every block shares: who is asking (scope), what is
 * filtered, and which recognition mode is active. The blocks below are pure
 * views over that state.
 *
 * Access is decided by the backend: an admin session sees everything, a referral
 * link sees one department, anyone else gets the login screen. The block
 * navigation only offers what the caller's scope actually allows — and the data
 * behind it was already filtered server-side, so hiding a tab is presentation,
 * not the security boundary.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { ArrowLeftIcon, RefreshIcon } from "@/components/icons";
import { currentLinkToken } from "./api";
import { LoginScreen } from "./access/login-screen";
import { AnalyticsBlock } from "./blocks/analytics";
import { CalendarBlock } from "./blocks/calendar";
import { JournalBlock } from "./blocks/journal";
import { RoadmapBlock } from "./blocks/pending";
import { SalesBlock } from "./blocks/sales";
import { ReceivablesBlock } from "./blocks/receivables";
import { ReportsBlock } from "./blocks/reports";
import { WarningsBlock } from "./blocks/warnings";
import { CommandPalette } from "./command-palette";
import { FilterBar, LiveIndicator, ModeControls } from "./controls";
import {
  AnalyticsIcon,
  BbcDashboardIcon,
  CalendarIcon,
  JournalIcon,
  ReceivablesIcon,
  ReportsIcon,
  RoadmapIcon,
  SalesIcon,
  UserIcon,
  WarningIcon,
} from "./icon";
import { type SavedView, useSavedViews } from "./saved-views";
import { useDataset } from "./use-dataset";
import { useLive } from "./use-live";

type BlockDefinition = {
  key: string;
  title: string;
  short: string;
  icon: typeof ReceivablesIcon;
  /** Scope permission required to open it. */
  requires: string;
};

const BLOCKS: BlockDefinition[] = [
  { key: "receivables", title: "Дебиторка", short: "Дебиторка", icon: ReceivablesIcon, requires: "receivables" },
  { key: "reports", title: "Отчёты", short: "Отчёты", icon: ReportsIcon, requires: "reports" },
  { key: "analytics", title: "Аналитика", short: "Аналитика", icon: AnalyticsIcon, requires: "analytics" },
  { key: "journal", title: "Журнал", short: "Журнал", icon: JournalIcon, requires: "journal" },
  { key: "calendar", title: "Платёжный календарь", short: "Календарь", icon: CalendarIcon, requires: "calendar" },
  { key: "sales", title: "Отдел продаж", short: "Продажи", icon: SalesIcon, requires: "sales" },
  { key: "warnings", title: "Предупреждения", short: "Предупреждения", icon: WarningIcon, requires: "warnings" },
  { key: "roadmap", title: "Будущие инструменты", short: "Планы", icon: RoadmapIcon, requires: "roadmap" },
];

export function BbcDashboardClient() {
  const {
    dataset,
    me,
    rows,
    filters,
    setFilters,
    toggleFilter,
    clearFilters,
    activeFilterCount,
    mode,
    setMode,
    block,
    setBlock,
    loading,
    error,
    unauthorized,
    reload,
  } = useDataset();

  const onLiveChange = useCallback(() => {
    void reload();
  }, [reload]);

  const live = useLive(dataset?.revision, onLiveChange, !unauthorized && !!dataset);

  const linkToken = typeof window === "undefined" ? null : currentLinkToken();

  const { views, save: saveView, remove: removeView } = useSavedViews();
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");

  // Плотность вешается на <html>, чтобы правила из globals.css достали до всех
  // блоков без прокидывания пропа через каждый компонент.
  useEffect(() => {
    document.documentElement.dataset.bbcDensity = density;
    return () => {
      delete document.documentElement.dataset.bbcDensity;
    };
  }, [density]);

  const applyView = useCallback(
    (view: SavedView) => {
      setFilters(view.filters);
      setMode(view.mode);
      setBlock(view.block);
    },
    [setFilters, setMode, setBlock],
  );

  const isAdmin = dataset?.scope.departments.includes("*") ?? false;

  const allowedBlocks = useMemo(() => {
    if (!dataset) return [];
    const granted = new Set(dataset.scope.blocks);
    const all = granted.has("*");
    return BLOCKS.filter((item) => all || granted.has(item.requires));
  }, [dataset]);

  const activeBlock = useMemo(() => {
    if (!allowedBlocks.length) return null;
    return allowedBlocks.find((item) => item.key === block) ?? allowedBlocks[0];
  }, [allowedBlocks, block]);

  if (unauthorized) {
    // `linkExpired` distinguishes "never signed in" from "the link stopped
    // working while you were reading" — the second needs a different message.
    return (
      <LoginScreen
        needsSetup={me?.needs_setup ?? false}
        linkExpired={!!linkToken}
        onSignedIn={() => void reload()}
      />
    );
  }

  if (loading && !dataset) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-3"
        style={{ background: "var(--page-bg)" }}
      >
        <span className="logo-badge animate-spin-slow">
          <BbcDashboardIcon size={16} />
        </span>
        <p className="mono-meta">Читаем таблицу…</p>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Первая загрузка занимает несколько секунд
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--page-bg)" }}>
      <header
        className="sticky top-0 z-40 border-b backdrop-blur-md"
        style={{ background: "var(--header-bg)", borderColor: "var(--border-subtle)" }}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <Link
              href="/services"
              className="btn-ghost text-xs px-2.5 py-1.5 flex items-center gap-1.5"
              title="К сервисам"
            >
              <ArrowLeftIcon size={15} />
              <span className="hidden sm:inline">Назад</span>
            </Link>
            <span className="logo-badge">
              <BbcDashboardIcon size={16} />
            </span>
            <span
              className="text-sm font-semibold truncate"
              style={{ color: "var(--text-primary)", letterSpacing: "-0.01em" }}
            >
              BBC · управленческий отчёт
            </span>
            {dataset && !isAdmin && dataset.scope.label ? (
              <span
                className="text-[0.68rem] px-2 py-0.5 rounded-full shrink-0"
                style={{ background: "var(--accent-soft)", color: "var(--text-accent)" }}
                title="Доступ по ссылке отдела"
              >
                {dataset.scope.label}
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <LiveIndicator live={live} />
            {dataset ? (
              <CommandPalette
                dataset={dataset}
                blocks={allowedBlocks.map((item) => ({ key: item.key, title: item.title }))}
                savedViews={views}
                onBlock={setBlock}
                onMode={setMode}
                onFilter={toggleFilter}
                onSearch={(value) => setFilters((current) => ({ ...current, search: value }))}
                onApplyView={applyView}
              />
            ) : null}
            <button
              type="button"
              onClick={() => setDensity((value) => (value === "compact" ? "comfortable" : "compact"))}
              className="btn-ghost text-xs px-2.5 py-1.5 hidden md:flex items-center gap-1.5"
              title={density === "compact" ? "Комфортная плотность" : "Компактная плотность"}
            >
              {density === "compact" ? "Плотно" : "Свободно"}
            </button>
            <button
              type="button"
              onClick={() => void reload(true)}
              disabled={loading}
              className="btn-ghost text-xs px-2.5 py-1.5 flex items-center gap-1.5"
              title="Перечитать таблицу сейчас"
            >
              <RefreshIcon size={15} />
              <span className="hidden sm:inline">{loading ? "Обновление…" : "Обновить"}</span>
            </button>
            {isAdmin ? (
              <Link
                href="/bbc-dashboard/account"
                className="btn-ghost text-xs px-2.5 py-1.5 flex items-center gap-1.5"
                title="Личный кабинет"
              >
                <UserIcon size={15} />
                <span className="hidden sm:inline">Кабинет</span>
              </Link>
            ) : null}
          </div>
        </div>

        <nav className="flex gap-1 px-3 overflow-x-auto scrollbar-hidden" aria-label="Разделы">
          {allowedBlocks.map((item) => {
            const Icon = item.icon;
            const active = activeBlock?.key === item.key;
            const badge = item.key === "warnings" ? dataset?.warnings_summary.total ?? 0 : 0;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setBlock(item.key)}
                className={`flex shrink-0 items-center gap-1.5 px-3 py-2 text-xs whitespace-nowrap border-b-2 ${
                  active ? "tab-active" : "tab-inactive"
                }`}
                style={{ transition: "color var(--dur-fast)" }}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={14} />
                {item.short}
                {badge ? (
                  <span
                    className="ml-0.5 px-1.5 rounded-full text-[0.6rem] bbc-num"
                    style={{
                      background: dataset?.warnings_summary.critical
                        ? "var(--accent-rose)"
                        : "var(--accent-amber)",
                      color: "var(--accent-fg)",
                    }}
                  >
                    {badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>
      </header>

      <main className="flex-1 w-full max-w-[1400px] mx-auto px-4 py-5 flex flex-col gap-4">
        {error ? (
          <div
            className="card p-4 text-sm"
            style={{ color: "var(--accent-rose)", borderColor: "var(--outflow-border)" }}
            role="alert"
          >
            {error}
          </div>
        ) : null}

        {dataset ? (
          <>
            <div className="card p-4 flex flex-col gap-3">
              <ModeControls dataset={dataset} mode={mode} onMode={setMode} />
              <div className="divider" />
              <FilterBar
                dataset={dataset}
                filters={filters}
                onToggle={toggleFilter}
                onSearch={(value) => setFilters((current) => ({ ...current, search: value }))}
                onClear={clearFilters}
                activeCount={activeFilterCount}
                visibleRows={rows.length}
                totalRows={dataset.rows.length}
              />
              <SavedViewsBar
                views={views}
                onApply={applyView}
                onRemove={removeView}
                onSave={(name) => saveView(name, block, mode, filters)}
              />
            </div>

            {activeBlock ? (
              <>
                <h2 className="sr-only">{activeBlock.title}</h2>
                {activeBlock.key === "receivables" ? <ReceivablesBlock rows={rows} mode={mode} /> : null}
                {activeBlock.key === "reports" ? <ReportsBlock rows={rows} mode={mode} /> : null}
                {activeBlock.key === "analytics" ? (
                  <AnalyticsBlock rows={rows} mode={mode} onFilter={toggleFilter} />
                ) : null}
                {activeBlock.key === "journal" ? <JournalBlock /> : null}
                {activeBlock.key === "calendar" ? <CalendarBlock /> : null}
                {activeBlock.key === "sales" ? <SalesBlock /> : null}
                {activeBlock.key === "warnings" ? (
                  <WarningsBlock
                    warnings={dataset.warnings}
                    summary={dataset.warnings_summary}
                    coverage={dataset.coverage}
                    rows={dataset.rows}
                  />
                ) : null}
                {activeBlock.key === "roadmap" ? <RoadmapBlock /> : null}
              </>
            ) : null}
          </>
        ) : null}
      </main>
    </div>
  );
}

/**
 * Полоска сохранённых видов.
 *
 * Вид — это связка «блок + режим + фильтры» под своим именем. Хранится локально,
 * но поделиться им можно ссылкой: всё состояние и так живёт в URL.
 */
function SavedViewsBar({
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
          className="btn-ghost text-[0.7rem] px-2.5 py-1"
          onClick={() => setNaming(true)}
          title="Сохранить текущие фильтры и режим"
        >
          + Сохранить вид
        </button>
      )}
    </div>
  );
}
