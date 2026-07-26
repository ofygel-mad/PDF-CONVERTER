"use client";

/**
 * Department access links — the core of the account page.
 *
 * One vertical row per department, each with: the short code button, «Сформировать
 * ссылку», the generated URL, a clock that turns the link temporary, and a cross
 * that revokes it.
 *
 * The scope behind a link lives server-side, bound to a hashed token: editing the
 * URL cannot widen what it shows. The raw URL is returned exactly once, at
 * creation, so it is kept in local state and never re-fetched.
 */
import { useEffect, useMemo, useState } from "react";

import { BbcApiError, createLink, fetchLinks, revokeLink } from "../api";
import { CheckIcon, ClockIcon, CopyIcon, LinkIcon } from "../icon";
import { dateLabel, expiresIn, relativeTime } from "../format";
import type { BbcLink } from "../types";

/** Codes as typed in «Отдел», with the readable name shown next to them. */
const DEPARTMENTS: Array<{ code: string; name: string }> = [
  { code: "ОБО", name: "Бухгалтерский отдел" },
  { code: "НО", name: "Налоговый отдел" },
  { code: "ЮО", name: "Юридический отдел" },
  { code: "HR", name: "Кадровый отдел" },
  { code: "ФО", name: "Финансовый отдел" },
];

const DURATIONS: Array<{ label: string; hours: number | null }> = [
  { label: "Бессрочно", hours: null },
  { label: "1 час", hours: 1 },
  { label: "24 часа", hours: 24 },
  { label: "7 дней", hours: 24 * 7 },
  { label: "30 дней", hours: 24 * 30 },
];

export function DepartmentLinks() {
  const [links, setLinks] = useState<BbcLink[]>([]);
  const [issued, setIssued] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useMemo(
    () => async () => {
      try {
        setLinks(await fetchLinks());
        setError(null);
      } catch (err) {
        setError(err instanceof BbcApiError ? err.message : "Не удалось загрузить ссылки");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  /**
   * Все действующие ссылки отдела, а не только последняя.
   *
   * Строка в списке одна на отдел, но ссылок за ней может стоять несколько —
   * например, если её выдали повторно, не отозвав старую. Раньше крестик снимал
   * только новейшую, и доступ по прежней продолжал работать: человек видел
   * «отозвано», а отдел оставался открыт. Поэтому отзыв идёт по всем сразу.
   */
  function activeLinks(code: string): BbcLink[] {
    return links.filter((link) => link.label === code && link.is_active);
  }

  async function issue(code: string, hours: number | null) {
    setError(null);
    try {
      const link = await createLink(code, hours);
      if (link.url) setIssued((previous) => ({ ...previous, [link.id]: link.url as string }));
      await reload();
    } catch (err) {
      setError(err instanceof BbcApiError ? err.message : "Не удалось создать ссылку");
    }
  }

  async function revoke(linkIds: string[]) {
    setError(null);
    try {
      for (const linkId of linkIds) await revokeLink(linkId);
      setIssued((previous) => {
        const next = { ...previous };
        for (const linkId of linkIds) delete next[linkId];
        return next;
      });
      await reload();
    } catch (err) {
      setError(err instanceof BbcApiError ? err.message : "Не удалось отозвать доступ");
    }
  }

  return (
    <section className="card p-5">
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Ссылки для руководителей отделов
        </h2>
        {/* Считаем открытые отделы, а не строки в таблице ссылок: строка в
            списке одна на отдел, и «2 активных» при одной видимой строке
            читалось как потерянная ссылка. */}
        <span className="mono-meta">
          {DEPARTMENTS.filter((item) => activeLinks(item.code).length).length} из{" "}
          {DEPARTMENTS.length} отделов открыто
        </span>
      </div>
      <p className="text-xs mb-5 max-w-2xl" style={{ color: "var(--text-secondary)" }}>
        По ссылке руководитель видит дебиторку, аналитику и платёжный календарь{" "}
        <strong style={{ color: "var(--text-primary)" }}>только своего отдела</strong>. Область
        видимости привязана к ссылке на сервере — изменить её в адресной строке нельзя. Без
        указанного срока ссылка бессрочная.
      </p>

      {error ? (
        <p
          className="text-xs px-3 py-2 rounded-lg mb-4"
          style={{
            color: "var(--accent-rose)",
            background: "var(--outflow-bg)",
            border: "1px solid var(--outflow-border)",
          }}
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-2.5">
        {DEPARTMENTS.map((department, index) => {
          const open = activeLinks(department.code);
          return (
            <DepartmentRow
              key={department.code}
              code={department.code}
              name={department.name}
              link={open[0]}
              extra={open.length - 1}
              // Адрес возвращается ровно один раз — при создании. Если его нет
              // в локальном состоянии, значит ссылку выдали в прошлый визит.
              url={open[0] ? issued[open[0].id] ?? null : null}
              loading={loading}
              index={index}
              onIssue={(hours) => issue(department.code, hours)}
              onRevoke={() => revoke(open.map((link) => link.id))}
              onReissue={async (hours) => {
                await revoke(open.map((link) => link.id));
                await issue(department.code, hours);
              }}
            />
          );
        })}
      </div>
    </section>
  );
}

type RowProps = {
  code: string;
  name: string;
  link: BbcLink | undefined;
  /** Сколько ещё действующих ссылок у отдела помимо показанной. */
  extra: number;
  url: string | null;
  loading: boolean;
  index: number;
  onIssue: (hours: number | null) => void;
  onRevoke: () => void;
  onReissue: (hours: number | null) => void;
};

function DepartmentRow({
  code,
  name,
  link,
  extra,
  url,
  loading,
  index,
  onIssue,
  onRevoke,
  onReissue,
}: RowProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard blocked (insecure origin / permissions) — the field is
      // selectable, so the user can still copy by hand.
    }
  }

  const remaining = link ? expiresIn(link.expires_at) : null;

  return (
    <div
      className="row-item p-3 animate-fade-in"
      style={{
        animationDuration: "var(--dur-base)",
        animationDelay: `calc(${index} * var(--dur-stagger))`,
        animationFillMode: "backwards",
      }}
    >
      <div className="flex items-center gap-2.5 flex-wrap">
        {/* Short department code — the button from the brief */}
        <span
          className="flex items-center justify-center font-semibold text-xs shrink-0"
          style={{
            width: 44,
            height: 32,
            borderRadius: "var(--radius-btn)",
            background: link ? "var(--accent-soft)" : "var(--bg-active)",
            border: `1px solid ${link ? "var(--accent-line)" : "var(--border-base)"}`,
            color: link ? "var(--text-accent)" : "var(--text-secondary)",
            transition: "background var(--dur-fast), border-color var(--dur-fast)",
          }}
          title={name}
        >
          {code}
        </span>

        <span className="text-xs hidden sm:inline shrink-0" style={{ color: "var(--text-muted)" }}>
          {name}
        </span>

        <div className="flex-1" />

        {!link ? (
          <>
            <button
              type="button"
              className="btn-ghost text-xs px-2.5 py-1.5 flex items-center gap-1.5"
              onClick={() => onIssue(null)}
              disabled={loading}
            >
              <LinkIcon size={14} />
              Сформировать ссылку
            </button>
            <button
              type="button"
              className="btn-ghost text-xs p-1.5"
              onClick={() => setPickerOpen((open) => !open)}
              title="Сделать ссылку временной"
              aria-label="Задать срок действия"
              aria-expanded={pickerOpen}
            >
              <ClockIcon size={15} />
            </button>
          </>
        ) : (
          <>
            {url ? (
              <>
                <input
                  readOnly
                  value={url}
                  onFocus={(event) => event.currentTarget.select()}
                  className="input-field text-xs flex-1 min-w-[200px]"
                  style={{ fontFamily: "var(--font-plex-mono), ui-monospace, monospace" }}
                  aria-label={`Ссылка для отдела ${code}`}
                />
                <button
                  type="button"
                  className="btn-ghost text-xs p-1.5"
                  onClick={copy}
                  title="Скопировать"
                  aria-label="Скопировать ссылку"
                >
                  {copied ? (
                    <span style={{ color: "var(--accent-emerald)" }}>
                      <CheckIcon size={15} />
                    </span>
                  ) : (
                    <CopyIcon size={15} />
                  )}
                </button>
              </>
            ) : (
              // Адрес в поле не показываем: сервер отдаёт его один раз, а
              // обрезанная подпись в инпуте читалась как кнопка «скопировать».
              // Вместо этого — состояние словами и способ получить новый адрес.
              <>
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  Доступ открыт. Адрес показывается один раз — при создании.
                </span>
                <button
                  type="button"
                  className="btn-ghost text-xs px-2.5 py-1.5 flex items-center gap-1.5"
                  onClick={() => onReissue(null)}
                  disabled={loading}
                  title="Отозвать текущую ссылку и выдать новую"
                >
                  <LinkIcon size={14} />
                  Выдать заново
                </button>
              </>
            )}
            <button
              type="button"
              className="btn-ghost text-xs p-1.5"
              onClick={onRevoke}
              title={
                extra > 0
                  ? `Отозвать все действующие ссылки отдела (${extra + 1})`
                  : "Отозвать доступ по этой ссылке"
              }
              aria-label={`Отозвать доступ для отдела ${code}`}
              style={{ color: "var(--accent-rose)" }}
            >
              ✕
            </button>
          </>
        )}
      </div>

      {pickerOpen && !link ? (
        <div className="flex flex-wrap gap-1.5 mt-2.5 pl-1">
          {DURATIONS.map((duration) => (
            <button
              key={duration.label}
              type="button"
              className="btn-ghost text-xs px-2.5 py-1"
              onClick={() => {
                setPickerOpen(false);
                onIssue(duration.hours);
              }}
            >
              {duration.label}
            </button>
          ))}
        </div>
      ) : null}

      {link ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 pl-1">
          <span className="mono-meta">
            {remaining ? `истекает через ${remaining}` : "бессрочная"}
          </span>
          <span className="mono-meta">
            переходов: {link.use_count}
            {link.last_used_at ? ` · ${relativeTime(link.last_used_at)}` : ""}
          </span>
          <span className="mono-meta">создана {dateLabel(link.created_at)}</span>
          {extra > 0 ? (
            <span className="mono-meta" style={{ color: "var(--accent-amber)" }}>
              + ещё {extra} действующих — крестик отзовёт все
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
