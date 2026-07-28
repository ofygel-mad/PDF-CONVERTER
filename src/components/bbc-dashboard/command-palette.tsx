"use client";

/**
 * Командная палитра (⌘K / Ctrl+K).
 *
 * Одно поле, из которого достаётся всё: разделы, пресеты режимов, сохранённые
 * виды, клиенты, фирмы, отделы, сотрудники. Выбор клиента не открывает карточку,
 * а ставит фильтр — то есть палитра управляет тем же состоянием, что и остальной
 * интерфейс, а не живёт отдельной жизнью.
 *
 * Полностью с клавиатуры: ↑↓ перебор, Enter выбор, Esc закрыть.
 */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { SearchIcon } from "./icon";
import type { BbcDataset, BbcMode } from "./types";
import type { SavedView } from "./saved-views";

/**
 * Подпись сочетания клавиш: «⌘K» на Mac, «Ctrl K» везде ещё.
 *
 * Через useSyncExternalStore, а не через прямое чтение navigator в рендере:
 * сервер обязан отрендерить то же, что и первый кадр клиента, иначе гидратация
 * ругается на расхождение. Серверный снапшот — «Ctrl K», клиент уточняет.
 */
const noopSubscribe = () => () => {};

function useShortcutLabel(): string {
  const mac = useSyncExternalStore(
    noopSubscribe,
    () => /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent || ""),
    () => false,
  );
  return mac ? "⌘K" : "Ctrl K";
}

type Action = {
  id: string;
  group: string;
  title: string;
  hint?: string;
  run: () => void;
};

type Props = {
  dataset: BbcDataset;
  blocks: Array<{ key: string; title: string }>;
  savedViews: SavedView[];
  onBlock: (key: string) => void;
  onMode: (mode: BbcMode) => void;
  onFilter: (key: "firms" | "departments" | "employees" | "serviceKinds", value: string) => void;
  onSearch: (value: string) => void;
  onApplyView: (view: SavedView) => void;
};

export function CommandPalette({
  dataset,
  blocks,
  savedViews,
  onBlock,
  onMode,
  onFilter,
  onSearch,
  onApplyView,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const shortcut = useShortcutLabel();
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Состояние сбрасывается в самих обработчиках, а не в эффекте на `open`:
  // setState внутри эффекта дал бы лишний каскадный рендер на каждом открытии.
  const show = useCallback(() => {
    setQuery("");
    setCursor(0);
    setOpen(true);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  // ⌘K / Ctrl+K открывает откуда угодно.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => {
          if (!value) {
            setQuery("");
            setCursor(0);
          }
          return !value;
        });
      }
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Фокус на поле, когда палитра появилась в DOM.
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, [open]);

  const actions = useMemo<Action[]>(() => {
    const out: Action[] = [];

    for (const block of blocks) {
      out.push({
        id: `block:${block.key}`,
        group: "Разделы",
        title: block.title,
        run: () => onBlock(block.key),
      });
    }

    for (const [key, preset] of Object.entries(dataset.presets)) {
      out.push({
        id: `preset:${key}`,
        group: "Режим отчёта",
        title: preset.title,
        hint: dataset.mode_descriptions[preset.mode],
        run: () => onMode(preset.mode),
      });
    }

    for (const view of savedViews) {
      out.push({
        id: `view:${view.id}`,
        group: "Сохранённые виды",
        title: view.name,
        run: () => onApplyView(view),
      });
    }

    for (const code of dataset.dimensions.departments) {
      out.push({
        id: `dep:${code}`,
        group: "Отделы",
        title: code,
        hint: "фильтр по отделу",
        run: () => onFilter("departments", code),
      });
    }

    for (const firm of dataset.dimensions.firms) {
      out.push({
        id: `firm:${firm}`,
        group: "Юрлица",
        title: firm,
        hint: "фильтр по фирме",
        run: () => onFilter("firms", firm),
      });
    }

    for (const employee of dataset.dimensions.employees) {
      out.push({
        id: `emp:${employee}`,
        group: "Сотрудники",
        title: employee,
        hint: "фильтр по сотруднику",
        run: () => onFilter("employees", employee),
      });
    }

    for (const client of dataset.dimensions.clients) {
      out.push({
        id: `client:${client}`,
        group: "Клиенты",
        title: client,
        hint: "поиск по клиенту",
        run: () => onSearch(client),
      });
    }

    return out;
  }, [dataset, blocks, savedViews, onBlock, onMode, onFilter, onSearch, onApplyView]);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const pool = needle
      ? actions.filter((action) => action.title.toLowerCase().includes(needle))
      : actions;
    return pool.slice(0, 40);
  }, [actions, query]);

  const choose = useCallback(
    (action: Action) => {
      action.run();
      close();
    },
    [close],
  );

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor((value) => Math.min(value + 1, matches.length - 1));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((value) => Math.max(value - 1, 0));
    }
    if (event.key === "Enter" && matches[cursor]) {
      event.preventDefault();
      choose(matches[cursor]);
    }
  }

  // Держим выделенную строку в поле зрения при переборе клавишами.
  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${cursor}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={show}
        className="btn-ghost text-xs px-2.5 py-1.5 flex items-center gap-1.5"
        title={`Поиск по разделам, клиентам и режимам (${shortcut})`}
      >
        {/* Раньше здесь стоял голый символ «⌘»: на Windows он рисуется
            прямоугольником-заменителем и читался как случайный знак. Действие
            называет иконка, а сочетание клавиш — подпись справа. */}
        <SearchIcon size={15} />
        <span className="hidden lg:inline">Поиск</span>
        <kbd
          className="hidden xl:inline mono-meta px-1.5 py-0.5 rounded"
          style={{ background: "var(--bg-active)", color: "var(--text-muted)" }}
        >
          {shortcut}
        </kbd>
      </button>
    );
  }

  let lastGroup = "";

  return (
    <>
      <button
        type="button"
        aria-label="Закрыть палитру"
        onClick={close}
        className="fixed inset-0 z-50"
        style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)" }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Командная палитра"
        className="fixed z-50 left-1/2 top-[12vh] w-[min(92vw,560px)] card animate-slide-up"
        style={{ transform: "translateX(-50%)", animationDuration: "var(--dur-base)", boxShadow: "var(--shadow-float)" }}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setCursor(0);
          }}
          onKeyDown={onKeyDown}
          placeholder="Раздел, режим, клиент, отдел, сотрудник…"
          className="w-full px-4 py-3 text-sm bg-transparent outline-none"
          style={{ color: "var(--text-primary)", borderBottom: "1px solid var(--border-subtle)" }}
          aria-label="Поиск команд"
        />

        <div ref={listRef} className="max-h-[52vh] overflow-y-auto py-1">
          {matches.length ? (
            matches.map((action, index) => {
              const header = action.group !== lastGroup ? action.group : null;
              lastGroup = action.group;
              return (
                <div key={action.id}>
                  {header ? <p className="eyebrow px-4 pt-2 pb-1">{header}</p> : null}
                  <button
                    type="button"
                    data-index={index}
                    onMouseEnter={() => setCursor(index)}
                    onClick={() => choose(action)}
                    className="w-full text-left px-4 py-1.5 flex items-baseline justify-between gap-3"
                    style={{
                      background: index === cursor ? "var(--accent-soft)" : "transparent",
                      color: index === cursor ? "var(--text-accent)" : "var(--text-primary)",
                    }}
                  >
                    <span className="text-sm truncate">{action.title}</span>
                    {action.hint ? (
                      <span className="mono-meta shrink-0 truncate max-w-[45%]">{action.hint}</span>
                    ) : null}
                  </button>
                </div>
              );
            })
          ) : (
            <p className="px-4 py-6 text-sm text-center" style={{ color: "var(--text-muted)" }}>
              Ничего не найдено
            </p>
          )}
        </div>

        <div
          className="px-4 py-2 flex items-center gap-4 mono-meta"
          style={{ borderTop: "1px solid var(--border-subtle)" }}
        >
          <span>↑↓ выбрать</span>
          <span>Enter применить</span>
          <span>Esc закрыть</span>
        </div>
      </div>
    </>
  );
}
