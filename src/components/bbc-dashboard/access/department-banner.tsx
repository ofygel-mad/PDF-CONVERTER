"use client";

/**
 * Полоса отдела — шапка экрана, открытого по реферальной ссылке.
 *
 * Раньше о том, что человек видит только свой отдел, говорил маленький чип
 * «ЮО» в общей шапке рядом с админскими кнопками. Экран выглядел как урезанный
 * общий дашборд: непонятно, свой он или сломанный. Здесь сказано прямо: чей
 * отдел, сколько договоров в нём видно, какие разделы открыты и до какого
 * момента действует ссылка.
 */
import type { CSSProperties } from "react";

import { BLOCK_TITLES, type Department } from "../department";
import { plural } from "../format";
import { deadlineLabel, useCountdown } from "../use-countdown";

export function DepartmentBanner({
  info,
  rowCount,
  blocks,
  expiresAt,
}: {
  info: Department;
  rowCount: number;
  blocks: string[];
  expiresAt: string | null | undefined;
}) {
  const countdown = useCountdown(expiresAt);

  const sections = blocks
    .filter((key) => key !== "control")
    .map((key) => BLOCK_TITLES[key] ?? key);

  return (
    <div
      className="bbc-enter border-b"
      style={
        {
          background: info.soft,
          borderColor: "var(--border-subtle)",
          "--enter-index": 2,
        } as CSSProperties
      }
    >
      <div className="w-full max-w-[1400px] mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
        <span
          className="flex items-center justify-center font-semibold text-sm shrink-0"
          style={{
            width: 46,
            height: 46,
            borderRadius: "var(--radius-btn)",
            background: "var(--bg-surface)",
            border: `1px solid ${info.tone}`,
            color: info.tone,
          }}
        >
          {info.code}
        </span>

        <div className="min-w-0">
          <h1
            className="text-base font-semibold truncate"
            style={{ color: "var(--text-primary)", letterSpacing: "-0.01em" }}
          >
            {info.name}
          </h1>
          <p className="mono-meta">
            {rowCount} {plural(rowCount, "договор", "договора", "договоров")} {info.genitive}
            {sections.length ? ` · ${sections.join(" · ")}` : ""}
          </p>
        </div>

        <div className="flex-1" />

        {/* Срок доступа — не сноска: по временной ссылке человек должен успеть
            понять, что она кончится, до того как она кончится. */}
        {expiresAt ? (
          <div className="text-right">
            <p
              className="text-xs font-semibold bbc-num"
              style={{
                color: countdown.expired
                  ? "var(--accent-rose)"
                  : countdown.urgent
                    ? "var(--accent-rose)"
                    : "var(--text-primary)",
              }}
            >
              {countdown.expired ? "доступ закрыт" : `доступ ещё ${countdown.label}`}
            </p>
            <p className="mono-meta">{deadlineLabel(expiresAt)}</p>
          </div>
        ) : (
          <p className="mono-meta">доступ по ссылке · без срока</p>
        )}
      </div>
    </div>
  );
}
