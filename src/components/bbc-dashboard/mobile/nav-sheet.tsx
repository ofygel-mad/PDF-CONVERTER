"use client";

/**
 * Лист «Ещё» — разделы, не поместившиеся в нижний бар.
 *
 * Держится отдельно от листа действий намеренно: если смешать «куда пойти» и
 * «что сделать», вкладка «Ещё» перестаёт быть предсказуемой.
 */
import type { CSSProperties } from "react";

import { ArrowRightIcon } from "../icon";
import { BottomSheet } from "./bottom-sheet";
import type { TabBlock } from "./bottom-tabs";

export function NavSheet({
  open,
  onClose,
  blocks,
  activeKey,
  warningCount,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  /** Только то, чего нет в баре. */
  blocks: TabBlock[];
  activeKey: string | undefined;
  warningCount: number;
  onSelect: (key: string) => void;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Разделы">
      <div className="bbc-glist pb-2">
        {blocks.map((item) => {
          const Icon = item.icon;
          const active = activeKey === item.key;
          const badge = item.key === "warnings" ? warningCount : 0;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelect(item.key)}
              aria-current={active ? "page" : undefined}
              className="flex items-center gap-3 text-left"
              style={
                {
                  padding: "0.625rem 0",
                  color: active ? "var(--dept-tone, var(--accent))" : "var(--text-primary)",
                } as CSSProperties
              }
            >
              <span className="shrink-0" style={{ color: "var(--text-muted)" }}>
                <Icon size={18} />
              </span>
              <span className="flex-1 min-w-0 truncate" style={{ fontSize: "var(--ios-value)" }}>
                {item.title}
              </span>
              {badge ? (
                <span
                  className="bbc-num shrink-0 px-1.5 rounded-full"
                  style={{
                    fontSize: "0.625rem",
                    background: "var(--accent-rose)",
                    color: "var(--accent-fg)",
                  }}
                >
                  {badge}
                </span>
              ) : null}
              <span className="shrink-0" style={{ color: "var(--text-muted)" }} aria-hidden="true">
                <ArrowRightIcon size={14} />
              </span>
            </button>
          );
        })}
      </div>
    </BottomSheet>
  );
}
