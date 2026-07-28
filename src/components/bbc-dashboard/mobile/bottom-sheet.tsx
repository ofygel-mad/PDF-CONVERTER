"use client";

/**
 * Лист снизу — основной модальный слой мобильного дашборда.
 *
 * Рисуется порталом в body, и это обязательное условие, а не вкусовщина: шапка
 * дашборда несёт и `backdrop-blur`, и `will-change` из `.bbc-enter`, а любого из
 * них хватает, чтобы она стала containing block. Тогда `position: fixed` внутри
 * отсчитывается от шапки, а не от окна, и «подложка на весь экран» выходит
 * ростом с шапку.
 *
 * Свайп вниз ловится только на шапке листа и грабере. На теле он не нужен и
 * вреден: там перетаскивание обязано скроллить содержимое.
 */
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { useScrollLock } from "../../use-scroll-lock";
import { CloseIcon } from "@/components/icons";
import { isTopSheet, popSheet, pushSheet } from "./sheet-stack";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Дальше этого — закрываем; ближе — лист возвращается на место. */
const DISMISS_PX = 96;
/** …или если бросили быстро, сколько бы ни протащили. */
const DISMISS_VELOCITY = 0.5;

export function BottomSheet({
  open,
  onClose,
  title,
  subtitle,
  detent = "auto",
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  /** `auto` — по содержимому до 88svh, `full` — сразу во весь допустимый рост. */
  detent?: "auto" | "full";
  footer?: ReactNode;
  children: ReactNode;
}) {
  const id = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const [drag, setDrag] = useState(0);
  // Признак «палец на экране» держим в состоянии, а не в ref: он читается при
  // отрисовке, чтобы на время перетаскивания снять переход.
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ y: number; time: number } | null>(null);

  useScrollLock(open);

  // Регистрация в стеке: Esc и подложка должны слушаться только верхним листом.
  useEffect(() => {
    if (!open) return;
    pushSheet(id);
    return () => popSheet(id);
  }, [open, id]);

  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    const timer = setTimeout(() => panelRef.current?.focus(), 0);
    return () => {
      clearTimeout(timer);
      // Фокус возвращается на кнопку, которая лист открыла: иначе после закрытия
      // он падает в начало страницы и чтение с клавиатуры начинается заново.
      restoreFocusRef.current?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (!isTopSheet(id)) return;

      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
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
  }, [open, id, onClose]);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse") return;
    dragStart.current = { y: event.clientY, time: event.timeStamp };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragStart.current) return;
    // Только вниз: тянуть лист вверх некуда, он и так у края.
    setDrag(Math.max(0, event.clientY - dragStart.current.y));
  }, []);

  const onPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const start = dragStart.current;
      dragStart.current = null;
      setDragging(false);
      if (!start) return;

      const distance = Math.max(0, event.clientY - start.y);
      const elapsed = Math.max(1, event.timeStamp - start.time);
      // Сдвиг обнуляем в обоих исходах: закрытый лист остаётся смонтированным,
      // и без сброса он открылся бы в следующий раз уже утащенным вниз.
      setDrag(0);
      if (distance > DISMISS_PX || distance / elapsed > DISMISS_VELOCITY) {
        onClose();
      }
    },
    [onClose],
  );

  if (!open) return null;

  const panelStyle: CSSProperties = {
    background: "var(--bg-surface)",
    borderTop: "1px solid var(--border-subtle)",
    borderTopLeftRadius: "var(--ios-sheet-radius)",
    borderTopRightRadius: "var(--ios-sheet-radius)",
    boxShadow: "var(--shadow-float)",
    maxHeight: "88svh",
    height: detent === "full" ? "88svh" : undefined,
    paddingBottom: "max(0.75rem, var(--safe-b))",
    transform: drag ? `translateY(${drag}px)` : undefined,
    // Пока палец на экране — никаких переходов, иначе лист отстаёт от него.
    transition: dragging ? "none" : "transform var(--dur-base) var(--ease-out)",
  };

  return createPortal(
    <>
      <button
        type="button"
        aria-label="Закрыть"
        onClick={onClose}
        className="fixed inset-0 z-50 bbc-sheet-backdrop"
        style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)" }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        tabIndex={-1}
        className="bbc-sheet fixed inset-x-0 bottom-0 z-50 flex flex-col outline-none"
        style={panelStyle}
      >
        <div
          className="shrink-0 cursor-grab touch-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="flex items-center justify-center" style={{ height: "var(--ios-tap)" }}>
            <span
              aria-hidden="true"
              style={{
                width: 36,
                height: 5,
                borderRadius: 9999,
                background: "var(--border-strong)",
              }}
            />
          </div>

          <div className="flex items-start justify-between gap-3 px-4 pb-3">
            <div className="min-w-0">
              <h2
                id={`${id}-title`}
                className="font-semibold truncate"
                style={{ color: "var(--text-primary)", fontSize: "var(--ios-title)" }}
              >
                {title}
              </h2>
              {subtitle ? (
                <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                  {subtitle}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть"
              className="btn-ghost shrink-0 flex items-center justify-center"
              style={{ width: "var(--ios-tap)", height: "var(--ios-tap)", padding: 0 }}
            >
              <CloseIcon size={16} />
            </button>
          </div>
        </div>

        {/* overscroll-contain: доскроллив список до конца, палец не должен
            начинать тащить страницу под листом. */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4" style={{ minHeight: 0 }}>
          {children}
        </div>

        {footer ? (
          <div
            className="shrink-0 px-4 pt-3"
            style={{ borderTop: "1px solid var(--border-subtle)" }}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </>,
    document.body,
  );
}
