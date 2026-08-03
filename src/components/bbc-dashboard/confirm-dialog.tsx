"use client";

/**
 * Подтверждение действия — окном продукта, а не окном браузера.
 *
 * `window.confirm` выглядит чужим, ставит кнопки в порядке ОС, не умеет
 * различать опасное и обычное действие и на телефоне выезжает системной
 * плашкой поверх всего. Здесь то же самое, но частью страницы: разрушительная
 * кнопка красная и стоит справа, Esc и клик по подложке отменяют, фокус
 * приезжает на неё и не уходит наружу.
 */
import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { isTopSheet, popSheet, pushSheet } from "./mobile/sheet-stack";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Подтвердить",
  cancelLabel = "Отмена",
  destructive = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Действие необратимо или теряет данные — кнопка красная. */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const id = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    pushSheet(id);
    return () => popSheet(id);
  }, [open, id]);

  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    // Фокус на подтверждение: диалог короткий, и человек уже решил — заставлять
    // его дойти сюда табом значит делать вид, что решение под сомнением.
    const timer = setTimeout(() => confirmRef.current?.focus(), 0);
    return () => {
      clearTimeout(timer);
      restoreFocusRef.current?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (!isTopSheet(id)) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key === "Tab") {
        const panel = panelRef.current;
        if (!panel) return;
        const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
        if (!items.length) return;
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
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, id, onCancel]);

  if (!open) return null;

  return createPortal(
    <>
      <button
        type="button"
        aria-label="Отмена"
        onClick={onCancel}
        className="fixed inset-0 z-[60] bbc-sheet-backdrop"
        style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)" }}
      />
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        tabIndex={-1}
        className="bbc-confirm outline-none"
      >
        <h2
          id={`${id}-title`}
          className="text-sm font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          {title}
        </h2>
        {body ? (
          <p className="text-xs mt-1.5 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            {body}
          </p>
        ) : null}

        <div className="flex justify-end gap-2 mt-4">
          <button type="button" className="btn-ghost text-xs px-3.5 py-2" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={destructive ? "bbc-btn-danger text-xs px-3.5 py-2" : "btn-primary text-xs px-3.5 py-2"}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
