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

import { type Department } from "../department";
import { plural } from "../format";
import { blockTitle } from "../shell/nav-items";
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

  // Строчными: перечень идёт внутри фразы «278 договоров отдела · дебиторка ·
  // журнал касаний», а не отдельным списком.
  const sections = blocks
    .filter((key) => key !== "control")
    .map((key) => blockTitle(key).toLowerCase());

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
          /* Бессрочность — не сноска, а самый весомый факт про этот доступ:
             ссылка на финансовые данные не перестанет работать сама. Раньше
             это стояло мелким приглушённым моно, то есть наименее заметным
             стилем в продукте, — при том что рядом обратный отсчёт по срочной
             ссылке набран полужирным. Теперь оба состояния весят одинаково.

             Цветом не выделено намеренно: цвет в этом продукте означает отказ,
             а бессрочная ссылка — не поломка, а решение, которое приняли. */
          <div className="text-right">
            <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
              доступ без срока
            </p>
            <p className="mono-meta">ссылка работает, пока её не закроют</p>
          </div>
        )}
      </div>
    </div>
  );
}
