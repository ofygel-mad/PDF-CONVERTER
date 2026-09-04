"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { booksApi, TYPE_LABEL, type TableView } from "@/components/books/api";
import { useScrollLock } from "@/components/use-scroll-lock";

/**
 * Форма записи — собирается по схеме книги, а не пишется под каждую.
 *
 * Тип поля выбирает контрол: деньги и числа — числовое поле, дата — календарь,
 * список — выпадающий, флажок — галочка, остальное — строка. Поэтому раздел
 * работает с любой книгой, включая ту, которую заведёт другая компания: чтобы
 * появилась новая форма, кода писать не надо.
 *
 * Порядок полей: сначала те, у которых есть роль. Они означают величины, по
 * которым дашборд считает, и заполнять их важнее. Остальные колонки книги
 * спрятаны под «Показать остальные» — их в журнале два десятка, и вываливать
 * их сразу значит спрятать главное среди служебного.
 *
 * Скелет модалки повторяет `blocks/touches/touch-modal.tsx`: портал, ловушка
 * фокуса, замок прокрутки, инлайн-ошибка. Так же, как там, — потому что это уже
 * работает и человек уже знает, как оно себя ведёт.
 */

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

type Props = {
  table: TableView;
  /** Правим существующую строку; пусто — заводим новую. */
  row: TableView["rows"][number] | null;
  onClose: () => void;
  onSaved: () => void;
};

export function RecordModal({ table, row, onClose, onSaved }: Props) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [showRest, setShowRest] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useScrollLock(true);

  const { bound, rest } = useMemo(() => {
    const fields = (table.fields ?? []).filter(
      (field) => !field.title.match(/^[.\-\s]*$/),
    );
    const bindings = table.bindings ?? {};
    return {
      bound: fields.filter((field) => bindings[field.key]),
      rest: fields.filter((field) => !bindings[field.key]),
    };
  }, [table.fields, table.bindings]);

  useEffect(() => {
    const seed: Record<string, string> = {};
    for (const field of [...bound, ...rest]) {
      const value = row?.values?.[field.key];
      seed[field.key] = value === null || value === undefined ? "" : String(value);
    }
    setValues(seed);
    setError("");
  }, [row, bound, rest]);

  useEffect(() => {
    restoreRef.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      restoreRef.current?.focus?.();
    };
  }, [onClose]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    // Пустые поля не отправляем: пустая строка и «не заполнено» — разные вещи,
    // и записывать первое вместо второго значит выдумывать данные.
    const payload = Object.fromEntries(
      Object.entries(values).filter(([, value]) => value !== ""),
    );
    try {
      if (row) {
        await booksApi.updateRow(table.table.id, row.id, payload, row.version);
      } else {
        await booksApi.createRow(table.table.id, payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить запись");
    } finally {
      setBusy(false);
    }
  }

  const titles = table.role_titles ?? {};
  const bindings = table.bindings ?? {};

  function control(field: TableView["fields"][number]) {
    const role = bindings[field.key];
    const label = field.title || field.key;
    const hint = role ? titles[role] ?? role : TYPE_LABEL[field.type] ?? field.type;
    const value = values[field.key] ?? "";
    const set = (next: string) =>
      setValues((current) => ({ ...current, [field.key]: next }));

    return (
      <label key={field.key} className="bbc-reg-field">
        <span className="bbc-reg-label">
          {label}
          <span className="bbc-reg-hint">{hint}</span>
        </span>
        {field.type === "bool" ? (
          <select className="input-field" value={value} onChange={(e) => set(e.target.value)}>
            <option value="">—</option>
            <option value="ДА">да</option>
            <option value="НЕТ">нет</option>
          </select>
        ) : field.type === "date" ? (
          <input
            className="input-field"
            type="date"
            value={value}
            onChange={(e) => set(e.target.value)}
          />
        ) : field.type === "money" || field.type === "number" ? (
          <input
            className="input-field"
            inputMode="decimal"
            placeholder="0"
            value={value}
            onChange={(e) => set(e.target.value)}
          />
        ) : (
          <input
            className="input-field"
            maxLength={500}
            value={value}
            onChange={(e) => set(e.target.value)}
          />
        )}
      </label>
    );
  }

  return createPortal(
    <>
      <button
        type="button"
        aria-label="Закрыть"
        onClick={onClose}
        className="fixed inset-0 z-50"
        style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)" }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={row ? "Правка записи" : "Новая запись"}
        tabIndex={-1}
        className="bbc-modal outline-none"
      >
        <div className="bbc-modal-head">
          <div className="min-w-0">
            <h2 className="font-semibold truncate" style={{ color: "var(--text-primary)" }}>
              {row ? "Правка записи" : "Новая запись"}
            </h2>
            <p className="bbc-reg-sub">{table.table.name}</p>
          </div>
          <button type="button" className="btn-ghost text-xs px-2.5 py-1.5" onClick={onClose}>
            Закрыть
          </button>
        </div>

        <form onSubmit={submit} className="bbc-reg-form">
          <div className="bbc-modal-body">
            <div className="bbc-reg-grid">{bound.map(control)}</div>

            {rest.length > 0 && (
              <>
                <button
                  type="button"
                  className="btn-ghost text-xs px-2.5 py-1.5 bbc-reg-more"
                  onClick={() => setShowRest((current) => !current)}
                >
                  {showRest
                    ? "Скрыть остальные колонки"
                    : `Показать остальные колонки (${rest.length})`}
                </button>
                {showRest && <div className="bbc-reg-grid">{rest.map(control)}</div>}
              </>
            )}

            {error && (
              <p className="bbc-reg-error" role="alert">
                {error}
              </p>
            )}
          </div>

          <div className="bbc-reg-foot">
            <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>
              Отмена
            </button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? "Сохраняем…" : row ? "Сохранить" : "Добавить"}
            </button>
          </div>
        </form>
      </div>
    </>,
    document.body,
  );
}
