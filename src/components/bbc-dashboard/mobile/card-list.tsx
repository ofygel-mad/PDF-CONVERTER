"use client";

/**
 * Одна спецификация колонок — две раскладки.
 *
 * На десктопе это таблица, на телефоне — сгруппированный список карточек. Обе
 * рисуются из одного описания полей, поэтому «добавить колонку» по-прежнему
 * значит дописать одну запись, а не править две разметки.
 *
 * Обе ветки в DOM одновременно, переключает их CSS. Так сделано намеренно:
 * компоненты-строки чистые, состояния и таймеров в них нет, а решение по ширине
 * окна из JS дало бы неверный первый кадр — сервер ширины не знает.
 *
 * Флаг `optional` работает в обе стороны и в этом весь смысл: в компактной
 * плотности на десктопе такие колонки **скрываются**, на телефоне —
 * **откладываются** под раскрытие в карточке. Одно объявление, два верных
 * поведения.
 */
import { useState, type CSSProperties, type ReactNode } from "react";

export type FieldSpec<T, C> = {
  key: string;
  /** Заголовок колонки на десктопе, подпись значения на телефоне. */
  header: string;
  align?: "left" | "right";
  /** Второстепенное: десктоп-компакт прячет, телефон убирает под раскрытие. */
  optional?: boolean;
  /** Заголовок карточки на телефоне. */
  primary?: boolean;
  /** Подзаголовок карточки: собирается через « · » из всех помеченных. */
  secondary?: boolean;
  cellClass?: string;
  tone?: string | ((row: T) => string | undefined);
  hint?: (row: T) => string | undefined;
  render: (row: T, ctx: C) => ReactNode;
};

type SpecProps<T, C> = {
  columns: FieldSpec<T, C>[];
  rows: T[];
  ctx: C;
  rowKey: (row: T) => string | number;
  /** Сколько строк показывать в таблице. */
  limit?: number;
  /** Сколько карточек показывать сразу на телефоне. */
  mobileLimit?: number;
  /** Классы строки: журнал красит приход и расход. */
  rowClassName?: (row: T) => string | undefined;
  /** Плавное проявление строк по очереди. */
  stagger?: boolean;
  empty?: string;
};

function toneOf<T>(tone: FieldSpec<T, never>["tone"], row: T): string | undefined {
  return typeof tone === "function" ? tone(row) : tone;
}

/**
 * Появление строк по очереди.
 *
 * Раньше этот объект был скопирован дословно в четырёх блоках; теперь он один.
 * Задержка упирается в потолок: на шестидесятой строке ждать полторы секунды
 * никто не станет.
 */
function staggerStyle(index: number, on: boolean): CSSProperties | undefined {
  if (!on) return undefined;
  return {
    animationDuration: "var(--dur-fast)",
    animationDelay: `calc(${Math.min(index, 20)} * var(--dur-stagger) / 2)`,
    animationFillMode: "backwards",
  };
}

/* ── Таблица (десктоп) ───────────────────────────────────────────────────────── */

export function SpecTable<T, C>({
  columns,
  rows,
  ctx,
  rowKey,
  limit = 60,
  rowClassName,
  stagger = true,
}: SpecProps<T, C>) {
  return (
    <div className="bbc-scroll-x -mx-1">
      <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                data-optional={column.optional ? "" : undefined}
                className={`font-medium px-2 py-1.5 whitespace-nowrap ${
                  column.align === "right" ? "text-right" : "text-left"
                }`}
                style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border-subtle)" }}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, limit).map((row, index) => (
            <tr
              key={rowKey(row)}
              className={`animate-fade-in ${rowClassName?.(row) ?? ""}`}
              style={staggerStyle(index, stagger)}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  data-optional={column.optional ? "" : undefined}
                  className={`px-2 py-1.5 ${column.cellClass ?? ""}`}
                  style={{ color: toneOf(column.tone, row) ?? "var(--text-secondary)" }}
                  title={column.hint?.(row)}
                >
                  {column.render(row, ctx)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Карточки (телефон) ──────────────────────────────────────────────────────── */

export function SpecCards<T, C>({
  columns,
  rows,
  ctx,
  rowKey,
  mobileLimit = 20,
  rowClassName,
}: SpecProps<T, C>) {
  const [shown, setShown] = useState(mobileLimit);

  const primary = columns.find((column) => column.primary);
  const secondary = columns.filter((column) => column.secondary);
  // Всё остальное — пары «подпись — значение». Заголовок и подзаголовки уже
  // показаны сверху, второй раз их печатать незачем.
  const pairs = columns.filter(
    (column) => !column.primary && !column.secondary,
  );
  const always = pairs.filter((column) => !column.optional);
  const extra = pairs.filter((column) => column.optional);

  return (
    <div className="flex flex-col gap-2">
      {rows.slice(0, shown).map((row) => (
        <RowCard
          key={rowKey(row)}
          row={row}
          ctx={ctx}
          primary={primary}
          secondary={secondary}
          always={always}
          extra={extra}
          className={rowClassName?.(row)}
        />
      ))}

      {rows.length > shown ? (
        <button
          type="button"
          onClick={() => setShown((value) => value + mobileLimit)}
          className="btn-ghost w-full text-xs"
        >
          Показать ещё {Math.min(mobileLimit, rows.length - shown)} из {rows.length - shown}
        </button>
      ) : null}
    </div>
  );
}

function RowCard<T, C>({
  row,
  ctx,
  primary,
  secondary,
  always,
  extra,
  className,
}: {
  row: T;
  ctx: C;
  primary?: FieldSpec<T, C>;
  secondary: FieldSpec<T, C>[];
  always: FieldSpec<T, C>[];
  extra: FieldSpec<T, C>[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`card-inner p-3 ${className ?? ""}`}>
      {primary ? (
        <p
          className="font-medium"
          // Заголовок переносится, а не обрезается: на телефоне обрезанное
          // никуда не раскрывается — `title` пальцем не достать.
          style={{
            color: "var(--text-primary)",
            fontSize: "var(--ios-value)",
            overflowWrap: "anywhere",
          }}
        >
          {primary.render(row, ctx)}
        </p>
      ) : null}

      {secondary.length ? (
        <p className="bbc-mini mt-0.5" style={{ color: "var(--text-muted)" }}>
          {secondary.map((column, index) => (
            <span key={column.key}>
              {index > 0 ? " · " : ""}
              {column.render(row, ctx)}
            </span>
          ))}
        </p>
      ) : null}

      <dl className="bbc-glist mt-2" style={{ "--ios-inset": "0" } as CSSProperties}>
        {always.map((column) => (
          <Pair key={column.key} column={column} row={row} ctx={ctx} />
        ))}
        {open ? extra.map((column) => (
          <Pair key={column.key} column={column} row={row} ctx={ctx} />
        )) : null}
      </dl>

      {extra.length ? (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="bbc-mini mt-1.5 flex items-center gap-1"
          style={{ color: "var(--text-accent)", minHeight: "var(--ios-tap)" }}
        >
          {open ? "Свернуть" : `Ещё ${extra.length} ${fields(extra.length)}`}
          <span aria-hidden="true">{open ? "▴" : "▾"}</span>
        </button>
      ) : null}
    </div>
  );
}

function Pair<T, C>({
  column,
  row,
  ctx,
}: {
  column: FieldSpec<T, C>;
  row: T;
  ctx: C;
}) {
  return (
    <div className="bbc-mrow">
      <dt>{column.header}</dt>
      <dd style={{ color: toneOf(column.tone, row) ?? "var(--text-primary)" }}>
        {column.render(row, ctx)}
      </dd>
    </div>
  );
}

function fields(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "поле";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "поля";
  return "полей";
}

/* ── Обе раскладки сразу ─────────────────────────────────────────────────────── */

export function SpecList<T, C>(props: SpecProps<T, C>) {
  if (!props.rows.length) {
    return (
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        {props.empty ?? "Нет строк в этом срезе."}
      </p>
    );
  }

  const limit = props.limit ?? 60;

  return (
    <>
      <div className="hidden sm:block">
        <SpecTable {...props} />
        {props.rows.length > limit ? (
          <p className="mono-meta mt-2 px-2">
            показано {limit} из {props.rows.length} — уточните фильтр, чтобы увидеть остальные
          </p>
        ) : null}
      </div>
      <div className="sm:hidden">
        <SpecCards {...props} />
      </div>
    </>
  );
}
