"use client";

/**
 * Ящик разделов — навигация дашборда на телефоне.
 *
 * До этого телефон и десктоп жили по разным правилам: наверху лента вкладок,
 * внизу таб-бар на пять слотов и шторка «Ещё» с остатком. Две навигации в одном
 * продукте, и ни одна не показывала все разделы сразу. Теперь список один и тот
 * же — просто на телефоне он выезжает по бургеру.
 *
 * Портал в body — обязателен, а не вкусовщина: у шапки дашборда есть
 * `backdrop-filter`, и этого достаточно, чтобы она стала containing block.
 * Тогда `position: fixed` внутри отсчитывается от шапки, и «подложка на весь
 * экран» выходит ростом с шапку.
 *
 * В отличие от референса в KORT (там ящик просто появляется, Esc не работает, и
 * фокус гуляет по странице под ним) — здесь есть анимация выезда, Esc, ловушка
 * фокуса и возврат фокуса на бургер при закрытии.
 */
import { useEffect, useId, useRef, type CSSProperties } from "react";
import { createPortal } from "react-dom";

import { CloseIcon } from "@/components/icons";
import { useScrollLock } from "../../use-scroll-lock";
import { BbcDashboardIcon } from "../icon";
import { isTopSheet, popSheet, pushSheet } from "../mobile/sheet-stack";
import type { BlockDefinition } from "./nav-items";
import { CONTROL_BLOCK } from "./nav-items";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function MobileDrawer({
  open,
  onClose,
  blocks,
  activeKey,
  warningCount,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  blocks: BlockDefinition[];
  activeKey: string | undefined;
  warningCount: number;
  onSelect: (key: string) => void;
}) {
  const id = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useScrollLock(open);

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
      // Фокус возвращается на бургер, который ящик открыл: иначе после закрытия
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

  if (!open) return null;

  return createPortal(
    <>
      <button
        type="button"
        aria-label="Закрыть меню"
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
        className="bbc-drawer fixed inset-y-0 left-0 z-50 flex flex-col outline-none"
      >
        <div className="bbc-drawer-head">
          <span className="flex items-center gap-2 min-w-0">
            <span className="bbc-sidebar-glyph">
              <BbcDashboardIcon size={17} />
            </span>
            <span
              id={`${id}-title`}
              className="font-semibold truncate"
              style={{ color: "var(--text-primary)", fontSize: "var(--ios-title)" }}
            >
              Разделы
            </span>
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть меню"
            className="btn-ghost shrink-0 flex items-center justify-center"
            style={{ width: "var(--ios-tap)", height: "var(--ios-tap)", padding: 0 }}
          >
            <CloseIcon size={16} />
          </button>
        </div>

        <nav
          className="flex-1 overflow-y-auto overscroll-contain py-1"
          aria-label="Разделы"
          style={{ minHeight: 0 }}
        >
          {blocks.map((item) => {
            const Icon = item.icon;
            const badge = item.key === "warnings" ? warningCount : 0;
            return (
              <button
                key={item.key}
                type="button"
                className="bbc-drawer-item"
                data-pinned={item.key === CONTROL_BLOCK.key ? "" : undefined}
                aria-current={activeKey === item.key ? "page" : undefined}
                onClick={() => {
                  onSelect(item.key);
                  onClose();
                }}
              >
                <Icon size={18} />
                <span className="flex-1 min-w-0 truncate text-left">{item.short}</span>
                {badge ? (
                  <span
                    className="bbc-num shrink-0"
                    style={
                      {
                        minWidth: 18,
                        height: 18,
                        padding: "0 5px",
                        borderRadius: 9999,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.625rem",
                        background: "var(--accent-rose)",
                        color: "var(--accent-fg)",
                      } as CSSProperties
                    }
                  >
                    {badge > 99 ? "99+" : badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>
      </div>
    </>,
    document.body,
  );
}
