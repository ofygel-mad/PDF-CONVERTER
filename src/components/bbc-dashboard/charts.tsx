"use client";

/**
 * Inline SVG chart primitives, drawn on the design tokens.
 *
 * No charting library on purpose: the set of shapes here is small, and the tokens
 * (`--accent`, `--accent-emerald/amber/rose`, `--border-*`) already carry the
 * light/dark behaviour, so hand-rolled SVG lands exactly on the design system and
 * costs nothing in bundle size.
 *
 * Motion rule everywhere: only transform/opacity, staggered by --dur-stagger,
 * and silent under prefers-reduced-motion (durations collapse to 0 in CSS).
 */
import type { ReactNode } from "react";

import { money, moneyShort, monthShort, percent } from "./format";

/* ── Bar row ─────────────────────────────────────────────────────────────────── */

export function BarRow({
  label,
  value,
  max,
  total,
  hint,
  tone = "accent",
  index = 0,
  onClick,
}: {
  label: string;
  value: number;
  /** Длина полоски задаётся относительно этого значения — обычно это максимум в группе. */
  max: number;
  /** Сумма по всей группе. Если передана, рядом показывается доля от целого. */
  total?: number;
  hint?: string;
  tone?: "accent" | "emerald" | "amber" | "rose" | "muted";
  index?: number;
  onClick?: () => void;
}) {
  const width = max > 0 ? Math.max(0, (value / max) * 100) : 0;
  const colour = toneColour(tone);
  const Wrapper = onClick ? "button" : "div";
  // Полоска длиной во всю строку означает «крупнейший в группе», а не «100%».
  // Без явной доли это читается неверно — поэтому доля выводится числом.
  const share = total ? value / total : null;

  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className="w-full text-left group"
      style={{ display: "block" }}
    >
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <span className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>
          {label}
        </span>
        <span className="text-xs bbc-num shrink-0" style={{ color: "var(--text-primary)" }}>
          {hint ?? money(value)}
          {share !== null ? (
            <span style={{ color: "var(--text-muted)" }}> · {percent(share)}</span>
          ) : null}
        </span>
      </div>
      <div
        className="h-1.5 rounded-full overflow-hidden"
        style={{ background: "var(--bg-active)" }}
      >
        <div
          className="h-full rounded-full bbc-grow"
          style={{
            width: `${width}%`,
            background: colour,
            transformOrigin: "left",
            animationDelay: `calc(${index} * var(--dur-stagger))`,
            transition: "width var(--dur-slow) var(--ease-out)",
          }}
        />
      </div>
    </Wrapper>
  );
}

export function toneColour(tone: string): string {
  switch (tone) {
    case "emerald":
      return "var(--accent-emerald)";
    case "amber":
      return "var(--accent-amber)";
    case "rose":
      return "var(--accent-rose)";
    case "muted":
      return "var(--text-muted)";
    default:
      return "var(--accent)";
  }
}

/* ── Bridge ──────────────────────────────────────────────────────────────────── */

export type BridgeStage = {
  key: string;
  label: string;
  value: number;
  /** Rendered as an indented "leak" under the stage above it. */
  leak?: { label: string; value: number; tone: "rose" | "amber" | "emerald"; onClick?: () => void };
};

/**
 * The reconciliation bridge.
 *
 * Deliberately not a funnel: in this data payments outnumber signed acts, so the
 * stages are not monotonic. The gaps between them fork in two directions —
 * receivables on one side, prepayments on the other — which is exactly the
 * mechanism the balance sheet is built on.
 */
export function Bridge({ stages }: { stages: BridgeStage[] }) {
  const max = Math.max(...stages.map((stage) => stage.value), 1);

  return (
    <div className="flex flex-col gap-1">
      {stages.map((stage, index) => (
        <div key={stage.key}>
          <div
            className="animate-fade-in"
            style={{
              animationDuration: "var(--dur-base)",
              animationDelay: `calc(${index * 2} * var(--dur-stagger))`,
              animationFillMode: "backwards",
            }}
          >
            <div className="flex items-baseline justify-between gap-3 mb-1">
              <span className="text-xs" style={{ color: "var(--text-primary)" }}>
                {stage.label}
              </span>
              <span className="text-sm font-semibold bbc-num" style={{ color: "var(--text-primary)" }}>
                {money(stage.value)}
              </span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-active)" }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(stage.value / max) * 100}%`,
                  background: "var(--accent)",
                  transition: "width var(--dur-tell) var(--ease-out)",
                }}
              />
            </div>
          </div>

          {stage.leak ? (
            <button
              type="button"
              onClick={stage.leak.onClick}
              disabled={!stage.leak.onClick}
              className="w-full text-left pl-5 py-1.5 rounded-lg transition-colors"
              style={{ cursor: stage.leak.onClick ? "pointer" : "default" }}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-xs flex items-center gap-1.5" style={{ color: toneColour(stage.leak.tone) }}>
                  <span aria-hidden="true">└</span>
                  {stage.leak.label}
                </span>
                <span className="text-xs bbc-num" style={{ color: toneColour(stage.leak.tone) }}>
                  {money(stage.leak.value)}
                </span>
              </div>
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/* ── Monthly columns with the two accrual cycles ─────────────────────────────── */

export function CycleColumns({
  data,
  showCycles,
}: {
  data: Array<{ month: string; cycle1: number; cycle2: number; total: number }>;
  showCycles: boolean;
}) {
  const max = Math.max(...data.map((item) => item.total), 1);
  const total = data.reduce((sum, item) => sum + item.total, 0);
  if (!data.length) return <EmptyChart />;

  return (
    // Резиновые колонки работают до тех пор, пока их немного: на 390px за
    // вычетом отступов страницы и карточки остаётся ~326px, и на двенадцати
    // месяцах это 19px на колонку при подписи шириной 35px. Поэтому на телефоне
    // колонка получает твёрдые 56px, а сам ряд — прокрутку.
    <div className="bbc-cycle-cols" role="img" aria-label="Признанная выручка по месяцам">
      {data.map((item, index) => (
        <div key={item.month} className="flex flex-col items-center gap-1.5 min-w-0">
          {/* Область роста колонки: даёт столбцу определённую высоту, иначе
              процентная высота внутри flex-элемента схлопывается в ноль.
              Подпись живёт здесь же, прямо над столбцом: у верхнего края карточки
              она отрывалась от коротких месяцев и читалась как чужая. */}
          <div className="flex-1 w-full flex flex-col justify-end min-h-0">
            <span
              className="bbc-micro bbc-num text-center mb-1"
              style={{ color: "var(--text-secondary)" }}
            >
              {moneyShort(item.total)}
            </span>
            <div
              className="w-full flex flex-col justify-end rounded-t-md overflow-hidden bbc-grow"
              style={{
                height: `${Math.max(2, (item.total / max) * 100)}%`,
                animationDelay: `calc(${index} * var(--dur-stagger))`,
                // Именно это делает переключение варианта перетеканием, а не
                // перерисовкой: высота едет к новому значению за --dur-tell.
                transition: "height var(--dur-tell) var(--ease-out)",
              }}
              title={`${item.month}: цикл 1 ${money(item.cycle1)}, цикл 2 ${money(item.cycle2)}`}
            >
            {showCycles ? (
              <>
                {/* Cycle 2 sits on top: it is the later half of the month. */}
                <div
                  style={{
                    height: `${item.total ? (item.cycle2 / item.total) * 100 : 0}%`,
                    background: "var(--accent)",
                    transition: "height var(--dur-tell) var(--ease-out)",
                  }}
                />
                <div
                  style={{
                    height: `${item.total ? (item.cycle1 / item.total) * 100 : 0}%`,
                    // Смешиваем акцент с фоном, а не берём почти прозрачный
                    // --accent-soft: тот сливался с карточкой, и цикл 1 пропадал.
                    background: "color-mix(in srgb, var(--accent) 42%, var(--bg-surface))",
                    borderTop: "1px solid var(--accent-line)",
                    transition: "height var(--dur-tell) var(--ease-out)",
                  }}
                />
              </>
            ) : (
              <div style={{ height: "100%", background: "var(--accent)" }} />
            )}
            </div>
          </div>
          <span className="bbc-micro truncate w-full text-center" style={{ color: "var(--text-muted)" }}>
            {monthShort(item.month)}
          </span>
          {/* Доля месяца в периоде: без неё высота столбца читается как
              «столько-то процентов», хотя она задана относительно максимума. */}
          <span className="bbc-micro bbc-num" style={{ color: "var(--text-muted)" }}>
            {total ? percent(item.total / total) : "—"}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── Sparkline ───────────────────────────────────────────────────────────────── */

export function Sparkline({
  values,
  width = 96,
  height = 26,
  tone = "accent",
}: {
  values: number[];
  width?: number;
  height?: number;
  tone?: "accent" | "emerald" | "rose" | "muted";
}) {
  if (values.length < 2) {
    return <div style={{ width: "100%", maxWidth: width, height }} aria-hidden="true" />;
  }

  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const step = width / (values.length - 1);
  const points = values
    .map((value, index) => `${index * step},${height - ((value - min) / span) * height}`)
    .join(" ");

  // `width`/`height` остаются системой координат viewBox — по ним считается
  // шаг между точками. Меняется только нарисованный бокс: он тянется по
  // контейнеру, а не держит 96px, из-за которых линия в строке списка
  // занимала треть доступного места.
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      style={{ width: "100%", height, display: "block" }}
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke={toneColour(tone)}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        // Растяжение по ширине не должно утолщать линию: без этого при
        // `preserveAspectRatio="none"` она поехала бы вместе с координатами.
        vectorEffect="non-scaling-stroke"
        // Draw-in: the line traces itself instead of appearing at once.
        style={{
          strokeDasharray: 1000,
          strokeDashoffset: 0,
          animation: "bbc-draw var(--dur-slow) var(--ease-out)",
        }}
      />
    </svg>
  );
}

/* ── Heatmap ─────────────────────────────────────────────────────────────────── */

export function Heatmap({
  rows,
  columns,
  valueAt,
  onCell,
}: {
  rows: string[];
  columns: string[];
  valueAt: (row: string, column: string) => number;
  onCell?: (row: string, column: string) => void;
}) {
  const values = rows.flatMap((row) => columns.map((column) => Math.abs(valueAt(row, column))));
  const max = Math.max(...values, 1);

  if (!rows.length) return <EmptyChart />;

  return (
    <>
    <div className="bbc-scroll-x">
      <table
        className="text-xs"
        style={{ borderCollapse: "separate", borderSpacing: 2, minWidth: 120 + columns.length * 64 }}
      >
        <thead>
          <tr>
            {/* Подпись строки замораживается: без неё, уехав вбок, уже не
                понять, чья это строка. */}
            <th
              className="text-left font-medium px-2 py-1 sticky left-0"
              style={{ color: "var(--text-muted)", background: "var(--bg-surface)", zIndex: 2 }}
            />
            {columns.map((column) => (
              <th
                key={column}
                className="font-medium px-2 py-1 whitespace-nowrap"
                style={{ color: "var(--text-muted)" }}
              >
                {monthShort(column)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={row}>
              <td
                className="bbc-heat-label px-2 py-1 truncate sticky left-0"
                style={{
                  color: "var(--text-secondary)",
                  background: "var(--bg-surface)",
                  boxShadow: "1px 0 0 var(--border-subtle)",
                  zIndex: 1,
                }}
                title={row}
              >
                {row}
              </td>
              {columns.map((column, columnIndex) => {
                const value = valueAt(row, column);
                const intensity = Math.min(1, Math.abs(value) / max);
                return (
                  <td key={column} className="p-0">
                    <button
                      type="button"
                      onClick={() => onCell?.(row, column)}
                      disabled={!onCell}
                      className="bbc-heat-cell w-full rounded bbc-cell-in bbc-num bbc-micro"
                      style={{
                        // A diagonal wave: delay grows with row + column.
                        animationDelay: `calc(${rowIndex + columnIndex} * var(--dur-stagger))`,
                        background: value
                          ? `color-mix(in srgb, ${
                              value < 0 ? "var(--accent-rose)" : "var(--accent)"
                            } ${Math.round(intensity * 70 + 8)}%, transparent)`
                          : "var(--bg-active)",
                        color: intensity > 0.55 ? "var(--accent-fg)" : "var(--text-secondary)",
                        cursor: onCell ? "pointer" : "default",
                      }}
                      title={`${row} · ${monthShort(column)}: ${money(value)}`}
                    >
                      {value ? moneyShort(value) : ""}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <p className="mono-meta mt-1.5 sm:hidden" style={{ color: "var(--text-muted)" }}>
      → таблицу можно листать вбок
    </p>
    </>
  );
}

/* ── Small pieces ────────────────────────────────────────────────────────────── */

export function Donut({
  slices,
  size = 108,
}: {
  slices: Array<{ label: string; value: number; tone: "accent" | "emerald" | "amber" | "rose" | "muted" }>;
  size?: number;
}) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  const radius = size / 2 - 8;
  const circumference = 2 * Math.PI * radius;

  if (!total) return <EmptyChart />;

  // Each arc's start is a prefix sum of the ones before it. Written as a pure
  // expression rather than a running accumulator: no mutation during render.
  // The slice count is single-digit, so the quadratic scan costs nothing.
  const fractions = slices.map((slice) => slice.value / total);
  const arcs = slices.map((slice, index) => ({
    ...slice,
    fraction: fractions[index],
    dash: fractions[index] * circumference,
    offset:
      fractions.slice(0, index).reduce((sum, fraction) => sum + fraction, 0) * circumference,
  }));

  // Кольцо тянется по контейнеру до своего размера, а на телефоне становится
  // крупнее: подписей у него нет — только SVG `<title>`, а он на сенсорном
  // экране не срабатывает. Читаются доли по легенде рядом.
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="bbc-donut"
      style={{ maxWidth: size }}
      role="img"
    >
      {arcs.map((arc) => (
        <circle
          key={arc.label}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={toneColour(arc.tone)}
          strokeWidth={10}
          strokeDasharray={`${arc.dash} ${circumference - arc.dash}`}
          strokeDashoffset={-arc.offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dasharray var(--dur-tell) var(--ease-out)" }}
        >
          <title>{`${arc.label}: ${money(arc.value)} (${percent(arc.fraction)})`}</title>
        </circle>
      ))}
    </svg>
  );
}

export function EmptyChart({ children }: { children?: ReactNode }) {
  return (
    <div
      className="flex items-center justify-center h-24 rounded-lg text-xs"
      style={{ background: "var(--bg-active)", color: "var(--text-muted)" }}
    >
      {children ?? "Нет данных для этого среза"}
    </div>
  );
}
