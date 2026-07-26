"use client";

/**
 * Сохранённые виды: именованная связка «фильтры + режим + блок».
 *
 * Живут в localStorage — это личная настройка одного человека на одном
 * устройстве, а не общие данные компании. Сама ссылка на вид остаётся
 * shareable через URL, поэтому поделиться видом можно и без синхронизации.
 */
import { useCallback, useSyncExternalStore } from "react";

import type { BbcMode } from "./types";
import type { Filters } from "./use-dataset";

const STORAGE_KEY = "bbc-dashboard:saved-views";
const MAX_VIEWS = 24;

export type SavedView = {
  id: string;
  name: string;
  block: string;
  mode: BbcMode;
  filters: Filters;
  createdAt: string;
};

function read(): SavedView[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as SavedView[]) : [];
  } catch {
    // Повреждённое хранилище не должно ронять дашборд — просто начинаем заново.
    return [];
  }
}

function write(views: SavedView[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(views.slice(0, MAX_VIEWS)));
  } catch {
    // Приватный режим или переполнение — молча продолжаем без сохранения.
  }
}

/* ── Внешнее хранилище ────────────────────────────────────────────────────────
   localStorage — внешний источник состояния, поэтому подписываемся на него через
   useSyncExternalStore, а не тянем в useState через эффект: так нет ни каскадных
   рендеров, ни рассинхрона с SSR (на сервере снапшот пустой). */

let cache: SavedView[] | null = null;
const listeners = new Set<() => void>();

function snapshot(): SavedView[] {
  if (cache === null) cache = read();
  return cache;
}

/** На сервере видов нет — ровно то, что отрендерится до гидратации. */
const EMPTY: SavedView[] = [];

function serverSnapshot(): SavedView[] {
  return EMPTY;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function commit(next: SavedView[]): void {
  cache = next;
  write(next);
  for (const listener of listeners) listener();
}

export function useSavedViews() {
  const views = useSyncExternalStore(subscribe, snapshot, serverSnapshot);

  const save = useCallback(
    (name: string, block: string, mode: BbcMode, filters: Filters): SavedView => {
      const view: SavedView = {
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        name: name.trim() || "Без названия",
        block,
        mode,
        filters,
        createdAt: new Date().toISOString(),
      };
      // Пересохранение под тем же именем заменяет вид, а не плодит дубли.
      commit([view, ...snapshot().filter((item) => item.name !== view.name)]);
      return view;
    },
    [],
  );

  const remove = useCallback((id: string) => {
    commit(snapshot().filter((item) => item.id !== id));
  }, []);

  return { views, save, remove };
}
