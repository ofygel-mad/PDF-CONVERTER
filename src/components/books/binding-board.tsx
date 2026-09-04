"use client";

import { useMemo, useState } from "react";

import {
  booksApi,
  CONFIDENCE_LABEL,
  TYPE_LABEL,
  type Board,
  type BoardField,
} from "@/components/books/api";

/**
 * Табло привязок — разговор двух сторон.
 *
 * Слева книга рассказывает о себе: какие колонки нашлись, что в них лежит,
 * насколько они заполнены. Справа приложение говорит, чего ему не хватает.
 * Наверху — следствие, ради которого всё и затевалось: какие разделы считаются
 * прямо сейчас, а каким чего недостаёт.
 *
 * Следствие стоит первым намеренно. Свободный конструктор, где колонки просто
 * раскладывают по гнёздам, отвечает лишь на полвопроса: собрал — и что теперь
 * считается? Ответ должен быть виден, не отходя от экрана.
 *
 * Про цвет
 * ────────
 * «Считается» показывается подписью и весом, без точки и без зелёного:
 * постоянно горящий индикатор «всё хорошо» перестают замечать ровно к тому
 * моменту, когда он должен был напугать. Цвет появляется только там, где
 * чего-то не хватает.
 *
 * Про выбор роли
 * ──────────────
 * Привязка меняется списком, а не перетаскиванием. Перетаскивание выглядит
 * живее, но не работает с клавиатуры, плохо живёт на телефоне и требует
 * попадания мышью в мелкую цель — а раскладывать предстоит сорок колонок.
 */

type Props = {
  board: Board;
  onChange: (board: Board) => void;
};

function fillLabel(field: BoardField): string {
  const ratio = field.stats.fill_ratio ?? 0;
  const scanned = field.stats.scanned ?? 0;
  if (!scanned) return "";
  return `заполнена на ${Math.round(ratio * 100)}%`;
}

function examplesLabel(field: BoardField): string {
  const examples = (field.stats.examples ?? []).slice(0, 2);
  return examples.length ? examples.join(" · ") : "";
}

export function BindingBoard({ board, onChange }: Props) {
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");

  /** Непривязанные наверх: это и есть «табло непонятных колонок». */
  const fields = useMemo(() => {
    const rank = (field: BoardField) => (field.role ? 1 : 0);
    return [...board.fields].sort(
      (a, b) => rank(a) - rank(b) || a.position - b.position,
    );
  }, [board.fields]);

  async function bind(field: BoardField, roleKey: string) {
    setSaving(field.key);
    setError("");
    try {
      const next = await booksApi.bind(
        board.table.id,
        field.key,
        roleKey || null,
      );
      onChange(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить привязку");
    } finally {
      setSaving(null);
    }
  }

  const waiting = board.sections.filter((s) => !s.computes);
  const working = board.sections.filter((s) => s.computes);

  return (
    <div className="bk-board">
      {/* ── Следствие ─────────────────────────────────────────────────── */}
      <section className="bk-consequence card">
        <h3 className="bk-consequence-title">Что считается прямо сейчас</h3>
        <div className="bk-consequence-grid">
          {working.map((section) => (
            <div key={section.key} className="bk-section bk-section-ok">
              <span className="bk-section-name">{section.title}</span>
              <span className="bk-section-note">считается</span>
            </div>
          ))}
          {waiting.map((section) => (
            <div key={section.key} className="bk-section bk-section-waiting">
              <span className="bk-section-name">{section.title}</span>
              <span className="bk-section-note">
                не хватает: {section.missing_titles.join(", ")}
              </span>
            </div>
          ))}
        </div>
        {waiting.length === 0 && (
          <p className="bk-hint">
            Все разделы получили то, что им нужно. Непривязанные колонки книги
            остаются на месте — они просто не участвуют в расчётах.
          </p>
        )}
      </section>

      {board.refusals.length > 0 && (
        <section className="bk-refusals card" role="alert">
          <h3 className="bk-consequence-title">Нужно решить вручную</h3>
          <ul>
            {board.refusals.map((refusal, index) => (
              <li key={index}>{refusal.reason}</li>
            ))}
          </ul>
        </section>
      )}

      {error && (
        <p className="bk-error" role="alert">
          {error}
        </p>
      )}

      {/* ── Колонки книги ─────────────────────────────────────────────── */}
      <section className="bk-fields">
        <h3 className="bk-consequence-title">
          Что нашлось в книге — {board.fields.length} колонок,{" "}
          {board.unbound.length} без роли
        </h3>
        <div className="bk-field-grid">
          {fields.map((field) => {
            const busy = saving === field.key;
            return (
              <div
                key={field.key}
                className={`bk-field card${field.role ? "" : " bk-field-free"}`}
              >
                <div className="bk-field-head">
                  <span className="bk-field-title" title={field.title}>
                    {field.title || "без заголовка"}
                  </span>
                  <span className="badge badge-slate">
                    {TYPE_LABEL[field.type] ?? field.type}
                  </span>
                </div>

                <p className="bk-field-stats">
                  {[fillLabel(field), examplesLabel(field)]
                    .filter(Boolean)
                    .join(" · ") || "в выборке пусто"}
                </p>

                <label className="bk-field-role">
                  <span className="sr-only">Роль для колонки «{field.title}»</span>
                  <select
                    className="input-field"
                    value={field.role ?? ""}
                    disabled={busy}
                    onChange={(event) => bind(field, event.target.value)}
                  >
                    <option value="">— не участвует в расчётах —</option>
                    {board.roles.map((role) => (
                      <option
                        key={role.key}
                        value={role.key}
                        disabled={!!role.bound_to && role.bound_to !== field.key}
                      >
                        {role.title}
                        {role.bound_to && role.bound_to !== field.key ? " (занята)" : ""}
                      </option>
                    ))}
                  </select>
                </label>

                {field.role && !field.confirmed && field.suggestion && (
                  <p className="bk-field-why">
                    предложено: {CONFIDENCE_LABEL[field.suggestion.confidence] ??
                      field.suggestion.confidence}
                  </p>
                )}
                {field.confirmed && <p className="bk-field-why">выбрано вручную</p>}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Гнёзда приложения ─────────────────────────────────────────── */}
      <section className="bk-roles">
        <h3 className="bk-consequence-title">Что нужно приложению</h3>
        <div className="bk-role-grid">
          {board.roles.map((role) => (
            <div
              key={role.key}
              className={`bk-role${role.bound_to ? "" : " bk-role-empty"}`}
            >
              <span className="bk-role-title">{role.title}</span>
              <span className="bk-role-note">
                {role.bound_to
                  ? board.fields.find((f) => f.key === role.bound_to)?.title ??
                    role.bound_to
                  : "гнездо пустое"}
              </span>
            </div>
          ))}
        </div>
        <p className="bk-hint">
          Роль занимает ровно одну колонку. Иначе одна и та же величина приезжала
          бы сразу из двух мест, и какая победит — зависело бы от порядка строк.
        </p>
      </section>
    </div>
  );
}
