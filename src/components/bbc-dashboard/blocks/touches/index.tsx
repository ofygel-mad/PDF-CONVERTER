"use client";

/**
 * Журнал касаний — вся работа по долгам в одном месте.
 *
 * Отвечает на два вопроса, ради которых его и просили:
 *   1. Что вообще делалось по этому должнику и кем.
 *   2. Сколько раз и до кого достучались — «Жанара 3 раза главбуху, 1 раз
 *      проджект-менеджеру», а я туда же писал как директор.
 *
 * Второй вопрос — сводкой сверху, первый — лентой снизу. Не наоборот: цифры
 * читают каждый день, а конкретную формулировку — когда уже что-то случилось.
 */
import { useCallback, useEffect, useMemo, useState } from "react";

import { BbcApiError, deleteTouch, fetchTouchOptions, fetchTouches, touchFileUrl } from "../../api";
import { dateLabel, plural } from "../../format";
import { TouchesIcon } from "../../icon";
import type { BbcRow, BbcTouch, BbcTouchOptions } from "../../types";
import { clientKey } from "../receivables/debt";
import { SectionCard } from "../shared";
import { describeAuthor, overview } from "./summary";
import { TouchModal } from "./touch-modal";

export function TouchesBlock({
  rows,
  canWrite,
  /** Открыли из реестра дебиторки по конкретному должнику. */
  focusClient,
  onClearFocus,
}: {
  rows: BbcRow[];
  canWrite: boolean;
  focusClient?: string | null;
  onClearFocus?: () => void;
}) {
  const [touches, setTouches] = useState<BbcTouch[]>([]);
  const [options, setOptions] = useState<BbcTouchOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [clientFilter, setClientFilter] = useState(focusClient ?? "");
  const [authorFilter, setAuthorFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BbcTouch | null>(null);

  // Клиенты, по которым этому человеку вообще есть что писать: те же строки,
  // что он видит в дебиторке. Свободный ввод здесь был бы ловушкой — имя должно
  // совпасть с книгой, иначе касание повиснет в стороне от долга.
  const clients = useMemo(() => {
    const seen = new Map<string, string>();
    for (const row of rows) {
      const name = (row.client || "").trim();
      if (name) seen.set(clientKey(name), name);
    }
    return [...seen.values()].sort((a, b) => a.localeCompare(b, "ru"));
  }, [rows]);

  const load = useCallback(async () => {
    setError(null);
    try {
      setTouches(await fetchTouches());
    } catch (err) {
      setError(err instanceof BbcApiError ? err.message : "Не удалось прочитать журнал");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    void fetchTouchOptions().then(setOptions).catch(() => setOptions(null));
  }, [load]);

  useEffect(() => {
    if (focusClient) setClientFilter(focusClient);
  }, [focusClient]);

  const visible = useMemo(() => {
    const key = clientFilter ? clientKey(clientFilter) : "";
    return touches.filter(
      (touch) =>
        (!key || touch.client_key === key) &&
        (!authorFilter || touch.author === authorFilter) &&
        (!roleFilter || touch.contact_role === roleFilter),
    );
  }, [touches, clientFilter, authorFilter, roleFilter]);

  const stats = useMemo(() => overview(visible), [visible]);
  const authors = useMemo(
    () => [...new Set(touches.map((touch) => touch.author))].sort((a, b) => a.localeCompare(b, "ru")),
    [touches],
  );

  async function remove(touch: BbcTouch) {
    if (!window.confirm(`Убрать касание по «${touch.client}» от ${dateLabel(touch.contacted_at)}?`)) {
      return;
    }
    try {
      await deleteTouch(touch.id);
      void load();
    } catch (err) {
      setError(err instanceof BbcApiError ? err.message : "Не удалось удалить");
    }
  }

  const filtered = !!clientFilter || !!authorFilter || !!roleFilter;

  return (
    <div className="flex flex-col gap-4">
      {/* ── Фильтры ─────────────────────────────────────────────────────── */}
      <div className="card p-3 flex flex-wrap items-end gap-2.5">
        <label className="flex flex-col gap-1.5 min-w-0 flex-1" style={{ minWidth: "12rem" }}>
          <span className="eyebrow">Должник</span>
          <select
            className="input-field"
            value={clientFilter}
            onChange={(event) => {
              setClientFilter(event.target.value);
              onClearFocus?.();
            }}
          >
            <option value="">Все</option>
            {clients.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 min-w-0" style={{ minWidth: "9rem" }}>
          <span className="eyebrow">Кто писал</span>
          <select
            className="input-field"
            value={authorFilter}
            onChange={(event) => setAuthorFilter(event.target.value)}
          >
            <option value="">Все</option>
            {authors.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 min-w-0" style={{ minWidth: "9rem" }}>
          <span className="eyebrow">Кому писали</span>
          <select
            className="input-field"
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
          >
            <option value="">Всем</option>
            {(options?.contact_roles ?? []).map((role) => (
              <option key={role.key} value={role.key}>
                {role.name}
              </option>
            ))}
          </select>
        </label>

        {filtered ? (
          <button
            type="button"
            className="btn-ghost text-xs px-3 py-2"
            onClick={() => {
              setClientFilter("");
              setAuthorFilter("");
              setRoleFilter("");
              onClearFocus?.();
            }}
          >
            Сбросить
          </button>
        ) : null}

        {canWrite ? (
          <button
            type="button"
            className="btn-primary text-xs px-3 py-2 ml-auto"
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
            disabled={!clients.length}
          >
            <TouchesIcon size={14} />
            Записать касание
          </button>
        ) : null}
      </div>

      {error ? (
        <div
          className="card p-4 text-sm"
          style={{ color: "var(--accent-rose)", borderColor: "var(--outflow-border)" }}
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {/* ── Сводка ──────────────────────────────────────────────────────── */}
      {stats.total > 0 ? (
        <SectionCard
          title={clientFilter || "Кто до кого достучался"}
          subtitle={
            `${stats.total} ${plural(stats.total, "касание", "касания", "касаний")}` +
            (clientFilter ? "" : ` по ${stats.clients} ${plural(stats.clients, "должнику", "должникам", "должникам")}`) +
            (stats.lastContact ? ` · последнее ${dateLabel(stats.lastContact)}` : "")
          }
        >
          <div className="flex flex-col gap-2">
            {stats.authors.map((author) => (
              <div
                key={author.author}
                className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-3 py-2 rounded-lg"
                style={{ background: "var(--bg-active)" }}
              >
                <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  {author.author}
                </span>
                {/* Предложением, а не таблицей: ровно так этот вопрос и задают. */}
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  {describeAuthor(author)}
                </span>
                {author.lastContact ? (
                  <span className="bbc-micro ml-auto shrink-0" style={{ color: "var(--text-muted)" }}>
                    {dateLabel(author.lastContact)}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </SectionCard>
      ) : null}

      {/* ── Лента ───────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="card p-8 text-center text-sm" style={{ color: "var(--text-secondary)" }}>
          Читаем журнал…
        </div>
      ) : !visible.length ? (
        <div className="card p-8 text-center text-sm" style={{ color: "var(--text-secondary)" }}>
          {filtered
            ? "Под фильтры не попало ни одно касание."
            : "Касаний пока нет. Первое можно записать прямо отсюда или из реестра дебиторки."}
        </div>
      ) : (
        <div className="card overflow-hidden">
          {visible.map((touch) => (
            <TouchRow
              key={touch.id}
              touch={touch}
              canWrite={canWrite}
              onEdit={() => {
                setEditing(touch);
                setModalOpen(true);
              }}
              onDelete={() => void remove(touch)}
            />
          ))}
        </div>
      )}

      <TouchModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={load}
        options={options}
        clients={clients}
        initial={editing}
        presetClient={editing ? undefined : clientFilter || undefined}
      />
    </div>
  );
}

function TouchRow({
  touch,
  canWrite,
  onEdit,
  onDelete,
}: {
  touch: BbcTouch;
  canWrite: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article
      className="bbc-touch-row"
      style={{ borderBottom: "1px solid var(--border-subtle)" }}
    >
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 min-w-0">
        <span className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
          {touch.client}
        </span>
        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
          {touch.author} → {touch.contact_role_name}
          {touch.contact_name ? ` (${touch.contact_name})` : ""}
        </span>
        <span className="bbc-micro ml-auto shrink-0 bbc-num" style={{ color: "var(--text-muted)" }}>
          {dateLabel(touch.contacted_at)} · {touch.channel_name}
        </span>
      </div>

      <p
        className="text-xs mt-1.5 leading-relaxed"
        style={{ color: "var(--text-secondary)", overflowWrap: "anywhere" }}
      >
        {touch.summary}
      </p>

      {touch.files.length ? (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {touch.files.map((file) => (
            <a
              key={file.id}
              href={touchFileUrl(file.id)}
              target="_blank"
              rel="noreferrer"
              className="bbc-micro px-2 py-1 rounded-md truncate"
              style={{
                maxWidth: "14rem",
                background: "var(--bg-active)",
                color: "var(--text-accent)",
              }}
            >
              {file.filename}
            </a>
          ))}
        </div>
      ) : null}

      {canWrite ? (
        <div className="flex gap-1.5 mt-2">
          <button type="button" className="btn-ghost bbc-micro px-2 py-1" onClick={onEdit}>
            Править
          </button>
          <button
            type="button"
            className="btn-ghost bbc-micro px-2 py-1"
            onClick={onDelete}
            style={{ color: "var(--accent-rose)" }}
          >
            Убрать
          </button>
        </div>
      ) : null}
    </article>
  );
}
