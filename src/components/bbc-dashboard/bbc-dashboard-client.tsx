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
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";

import { ArrowLeftIcon, RefreshIcon } from "@/components/icons";
import { currentLinkToken } from "./api";
import { DepartmentBanner } from "./access/department-banner";
import { LoginScreen } from "./access/login-screen";
import { AnalyticsBlock } from "./blocks/analytics";
import { CalendarBlock } from "./blocks/calendar";
import { ControlPanelBlock } from "./blocks/control-panel";
import { JournalBlock } from "./blocks/journal";
import { RoadmapBlock } from "./blocks/pending";
import { SalesBlock } from "./blocks/sales";
import { ReceivablesBlock } from "./blocks/receivables";
import { ReportsBlock } from "./blocks/reports";
import { WarningsBlock } from "./blocks/warnings";
import { CommandPalette } from "./command-palette";
import { ContextStrip, LiveIndicator } from "./controls";
import {
  AnalyticsIcon,
  BbcDashboardIcon,
  CalendarIcon,
  ControlPanelIcon,
  JournalIcon,
  ReceivablesIcon,
  ReportsIcon,
  RoadmapIcon,
  SalesIcon,
  UserIcon,
  WarningIcon,
} from "./icon";
import { department } from "./department";
import { type SavedView, useSavedViews } from "./saved-views";
import { useDataset } from "./use-dataset";
import { flip } from "./flip";
import { useLive } from "./use-live";

type BlockDefinition = {
  key: string;
  title: string;
  short: string;
  icon: typeof ReceivablesIcon;
  /** Scope permission required to open it. */
  requires: string;
};

/**
 * Смена раздела через нативный View Transitions API.
 *
 * Библиотека для этого не нужна: браузер сам снимает «до» и «после» и заводит
 * между ними псевдоэлементы, которые докрашиваются в globals.css. Имя перехода
 * висит только на области блока, поэтому шапка и панель фильтров не замирают на
 * время анимации. Где API нет (Firefox, Safari до 18) — обычный setState, и
 * раздел просто меняется мгновенно.
 */
type DocumentWithViewTransition = Document & {
  startViewTransition?: (callback: () => void) => unknown;
};

function withViewTransition(update: () => void) {
  const doc = typeof document === "undefined" ? null : (document as DocumentWithViewTransition);
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!doc?.startViewTransition || reduced) {
    update();
    return;
  }
  // flushSync обязателен: браузер снимает второй кадр сразу после колбэка, а
  // асинхронный рендер React в него не успел бы.
  doc.startViewTransition(() => flushSync(update));
}

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

/**
 * Панель управления — раздел, но не раздел данных.
 *
 * Область видимости её не ограничивает: у ссылок, выданных раньше, в базе
 * записан список из трёх блоков, и проверка по `scope.blocks` отняла бы у их
 * владельцев собственные настройки. Прятать тут нечего — данные приходят уже
 * отфильтрованными сервером, а это поверхность управления ими.
 */
const CONTROL_BLOCK: BlockDefinition = {
  key: "control",
  title: "Панель управления",
  short: "Панель управления",
  icon: ControlPanelIcon,
  requires: "control",
};

export function BbcDashboardClient() {
  const {
    dataset,
    me,
    adoptIdentity,
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
    refreshCooldown,
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

  /**
   * Смена плотности — с перелётом блоков.
   *
   * Атрибут переставляется прямо здесь, в обработчике, а не в эффекте: FLIP
   * обязан снять позиции «до» и «после» в одном кадре, а эффект React выполнится
   * только после коммита, когда мерить уже нечего. Состояние обновляется следом
   * и на раскладку не влияет — оно нужно переключателю, чтобы знать себя.
   */
  const applyDensity = useCallback((next: "comfortable" | "compact") => {
    flip(() => {
      document.documentElement.dataset.bbcDensity = next;
    });
    setDensity(next);
  }, []);

  const isAdmin = dataset?.scope.departments.includes("*") ?? false;

  /**
   * Экран отдела: свой тон и своя шапка.
   *
   * Ссылка всегда выдаётся на один отдел, поэтому берём первый код области
   * видимости. Для админа отдела нет — у него весь дашборд.
   */
  const departmentInfo = isAdmin ? null : department(dataset?.scope.departments[0]);
  const tone = departmentInfo?.tone;

  const allowedBlocks = useMemo(() => {
    if (!dataset) return [];
    const granted = new Set(dataset.scope.blocks);
    const all = granted.has("*");
    return [...BLOCKS.filter((item) => all || granted.has(item.requires)), CONTROL_BLOCK];
  }, [dataset]);

  const activeBlock = useMemo(() => {
    if (!allowedBlocks.length) return null;
    return allowedBlocks.find((item) => item.key === block) ?? allowedBlocks[0];
  }, [allowedBlocks, block]);

  // Куда возвращает кнопка «К разделу»: тот раздел с данными, из которого ушли
  // в настройки, а не первый попавшийся. Запоминается в самом переходе — это
  // обработчик события, а не эффект, поэтому лишнего каскада рендеров нет.
  const [lastDataBlock, setLastDataBlock] = useState("receivables");

  const goToBlock = useCallback(
    (key: string) => {
      const current = activeBlock?.key;
      if (current && current !== CONTROL_BLOCK.key && current !== key) setLastDataBlock(current);
      withViewTransition(() => setBlock(key));
    },
    [activeBlock, setBlock],
  );

  const applyView = useCallback(
    (view: SavedView) => {
      setFilters(view.filters);
      setMode(view.mode);
      goToBlock(view.block);
    },
    [setFilters, setMode, goToBlock],
  );

  const onPanel = activeBlock?.key === CONTROL_BLOCK.key;
  const backBlock =
    allowedBlocks.find((item) => item.key === lastDataBlock) ?? allowedBlocks[0];

  if (unauthorized) {
    // `linkExpired` distinguishes "never signed in" from "the link stopped
    // working while you were reading" — the second needs a different message.
    return (
      <LoginScreen
        needsSetup={me?.needs_setup ?? false}
        linkExpired={!!linkToken}
        onSignedIn={adoptIdentity}
      />
    );
  }

  if (loading && !dataset) {
    return (
      <div
        className="bbc-boot min-h-screen flex flex-col items-center justify-center gap-3"
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
    <div
      // На экране отдела тон расходится по карточкам и активной вкладке — это
      // и делает его «своим», не добавляя в систему второго акцентного цвета.
      className={`min-h-screen flex flex-col${departmentInfo ? " bbc-dept" : ""}`}
      style={{ background: "var(--page-bg)", ...(tone ? { "--dept-tone": tone } : null) } as CSSProperties}
    >
      <header
        className="bbc-enter sticky top-0 z-40 border-b backdrop-blur-md"
        style={
          {
            background: "var(--header-bg)",
            borderColor: "var(--border-subtle)",
            "--enter-index": 0,
          } as CSSProperties
        }
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

          </div>

          <div className="flex items-center gap-2 shrink-0">
            <LiveIndicator live={live} />
            {dataset ? (
              <CommandPalette
                dataset={dataset}
                blocks={allowedBlocks.map((item) => ({ key: item.key, title: item.title }))}
                savedViews={views}
                onBlock={goToBlock}
                onMode={setMode}
                onFilter={toggleFilter}
                onSearch={(value) => setFilters((current) => ({ ...current, search: value }))}
                onApplyView={applyView}
              />
            ) : null}
            {/* Тумблер живёт в шапке, а не в панели управления, ровно потому,
                что перестраиваются блоки на вкладках с данными: из панели их
                нет в DOM, и перелетать в момент клика было бы нечему. Обе
                позиции видны сразу — у одиночной кнопки «Плотно» не прочитать,
                это текущее состояние или то, что случится по клику. */}
            <div
              className="hidden md:flex items-center rounded-lg p-0.5 gap-0.5"
              style={{ background: "var(--bg-active)" }}
              role="group"
              aria-label="Плотность интерфейса"
            >
              {(
                [
                  { key: "comfortable", label: "Свободно", hint: "крупные плитки, блоки в колонку" },
                  { key: "compact", label: "Плотно", hint: "узкие плитки в ряд, блоки по двое" },
                ] as const
              ).map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => applyDensity(option.key)}
                  aria-pressed={density === option.key}
                  title={option.hint}
                  className="text-xs px-2.5 py-1 rounded-md"
                  style={{
                    background: density === option.key ? "var(--bg-surface)" : "transparent",
                    color: density === option.key ? "var(--text-primary)" : "var(--text-muted)",
                    transition: "background var(--dur-fast), color var(--dur-fast)",
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {/* Ручное чтение идёт прямо в Google мимо фонового цикла, поэтому у
                кнопки есть остывание: «не обновилось» обычно означает «в таблице
                не меняли», а не «нажми ещё десять раз». */}
            <button
              type="button"
              onClick={() => void reload(true)}
              disabled={loading || refreshCooldown > 0}
              className="btn-ghost text-xs px-2.5 py-1.5 flex items-center gap-1.5"
              title={
                refreshCooldown > 0
                  ? `Только что читали таблицу. Следующее ручное чтение через ${refreshCooldown} с — фоновое обновление идёт само каждые 15 секунд.`
                  : "Перечитать таблицу сейчас"
              }
            >
              <RefreshIcon size={15} />
              <span className="hidden sm:inline">
                {loading ? "Обновление…" : refreshCooldown > 0 ? `${refreshCooldown} с` : "Обновить"}
              </span>
            </button>
            {isAdmin ? (
              <Link
                href="/bbc-dashboard/account"
                prefetch
                className="btn-ghost text-xs px-2.5 py-1.5 flex items-center gap-1.5"
                title="Личный кабинет"
              >
                <UserIcon size={15} />
                <span className="hidden sm:inline">Кабинет</span>
              </Link>
            ) : null}
          </div>
        </div>

        <nav
          className="bbc-enter flex gap-1 px-3 overflow-x-auto scrollbar-hidden"
          style={{ "--enter-index": 1 } as CSSProperties}
          aria-label="Разделы"
        >
          {allowedBlocks.map((item) => {
            const Icon = item.icon;
            const active = activeBlock?.key === item.key;
            const badge = item.key === "warnings" ? dataset?.warnings_summary.total ?? 0 : 0;
            const isControl = item.key === CONTROL_BLOCK.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => goToBlock(item.key)}
                className={`flex shrink-0 items-center gap-1.5 px-3 py-2 text-xs whitespace-nowrap border-b-2 ${
                  active ? "tab-active" : "tab-inactive"
                }`}
                // Настройки отделены от разделов данных: они не про цифры, а про
                // то, как цифры считаются, — и не должны стоять с ними в ряд.
                style={{
                  transition: "color var(--dur-fast)",
                  ...(isControl
                    ? {
                        marginLeft: "auto",
                        borderLeft: "1px solid var(--border-subtle)",
                        paddingLeft: "0.9rem",
                      }
                    : null),
                }}
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

        {dataset && departmentInfo ? (
          <DepartmentBanner
            info={departmentInfo}
            rowCount={dataset.rows.length}
            blocks={dataset.scope.blocks}
            expiresAt={me?.link_expires_at}
          />
        ) : null}

        {/* Панель уехала в свою вкладку, но подпись под цифрой осталась здесь. */}
        {dataset && !onPanel ? (
          <ContextStrip
            dataset={dataset}
            mode={mode}
            filters={filters}
            activeCount={activeFilterCount}
            visibleRows={rows.length}
            totalRows={dataset.rows.length}
            live={live}
            onOpen={() => goToBlock(CONTROL_BLOCK.key)}
            onToggle={toggleFilter}
            onClear={clearFilters}
            tone={tone}
          />
        ) : null}
      </header>

      <main
        className="bbc-enter flex-1 w-full max-w-[1400px] mx-auto px-4 py-5 flex flex-col gap-4"
        style={{ "--enter-index": 3 } as CSSProperties}
      >
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
            {activeBlock ? (
              <div className="bbc-block-view flex flex-col gap-4">
                <h2 className="sr-only">{activeBlock.title}</h2>
                {activeBlock.key === CONTROL_BLOCK.key ? (
                  <ControlPanelBlock
                    dataset={dataset}
                    rows={rows}
                    mode={mode}
                    onMode={setMode}
                    filters={filters}
                    onToggleFilter={toggleFilter}
                    onSearch={(value) => setFilters((current) => ({ ...current, search: value }))}
                    onClearFilters={clearFilters}
                    activeFilterCount={activeFilterCount}
                    views={views}
                    onSaveView={(name) => saveView(name, lastDataBlock, mode, filters)}
                    onApplyView={applyView}
                    onRemoveView={removeView}
                    onBack={() => goToBlock(backBlock?.key ?? "receivables")}
                    backTitle={backBlock?.title ?? "Дебиторка"}
                    restricted={!isAdmin}
                    tone={tone}
                  />
                ) : null}
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
              </div>
            ) : null}
          </>
        ) : null}
      </main>
    </div>
  );
}
