"use client";

/**
 * Форма касания: кому написали, когда, к чему пришли, чем подтверждается.
 *
 * Файлы прикладываются ПОСЛЕ сохранения записи — иначе некуда: у файла есть
 * внешний ключ на касание. Поэтому форма живёт в двух состояниях: сначала
 * «записать», потом «приложить». Раздражения это не создаёт, потому что второй
 * шаг необязательный, а первый закрывает основную работу.
 *
 * На десктопе — модальное окно, на телефоне — тот же контент листом снизу.
 * Разметка одна: два верстания одной формы разъезжаются на первой же правке.
 */
import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";

import { CloseIcon } from "@/components/icons";
import { useScrollLock } from "../../../use-scroll-lock";
import { BbcApiError, createTouch, deleteTouchFile, touchFileUrl, updateTouch, uploadTouchFile } from "../../api";
import { CheckIcon } from "../../icon";
import { isTopSheet, popSheet, pushSheet } from "../../mobile/sheet-stack";
import type { BbcTouch, BbcTouchFile, BbcTouchOptions } from "../../types";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function TouchModal({
  open,
  onClose,
  onSaved,
  options,
  clients,
  initial,
  presetClient,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  options: BbcTouchOptions | null;
  /** Клиенты, доступные автору. Список, а не ввод: имя должно совпасть с книгой. */
  clients: string[];
  /** Правим существующее касание. */
  initial?: BbcTouch | null;
  /** Пришли из реестра по конкретному должнику — клиент уже известен. */
  presetClient?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const sheetId = "touch-modal";

  const [client, setClient] = useState("");
  const [contactedAt, setContactedAt] = useState(today());
  const [contactRole, setContactRole] = useState("");
  const [contactName, setContactName] = useState("");
  const [channel, setChannel] = useState("whatsapp");
  const [summary, setSummary] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** id сохранённого касания: пока его нет, приложить файл некуда. */
  const [savedId, setSavedId] = useState<number | null>(null);
  const [files, setFiles] = useState<BbcTouchFile[]>([]);
  const [uploading, setUploading] = useState(false);

  useScrollLock(open);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setBusy(false);
    setUploading(false);
    if (initial) {
      setClient(initial.client);
      setContactedAt(initial.contacted_at ?? today());
      setContactRole(initial.contact_role);
      setContactName(initial.contact_name);
      setChannel(initial.channel);
      setSummary(initial.summary);
      setSavedId(initial.id);
      setFiles(initial.files);
    } else {
      setClient(presetClient ?? "");
      setContactedAt(today());
      setContactRole(options?.contact_roles[0]?.key ?? "");
      setContactName("");
      setChannel("whatsapp");
      setSummary("");
      setSavedId(null);
      setFiles([]);
    }
  }, [open, initial, presetClient, options]);

  useEffect(() => {
    if (!open) return;
    pushSheet(sheetId);
    return () => popSheet(sheetId);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    const timer = setTimeout(() => panelRef.current?.focus(), 0);
    return () => {
      clearTimeout(timer);
      restoreFocusRef.current?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (!isTopSheet(sheetId)) return;
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
  }, [open, onClose]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const form = {
      client,
      contacted_at: contactedAt,
      contact_role: contactRole,
      contact_name: contactName,
      channel,
      summary,
    };
    try {
      const saved = savedId ? await updateTouch(savedId, form) : await createTouch(form);
      setSavedId(saved.id);
      setFiles(saved.files);
      onSaved();
      // Окно не закрывается: следующий шаг — приложить подтверждение, и
      // заставлять открывать запись заново ради этого незачем.
    } catch (err) {
      setError(err instanceof BbcApiError ? err.message : "Не удалось сохранить");
    } finally {
      setBusy(false);
    }
  }

  async function attach(list: FileList | null) {
    if (!list?.length || !savedId) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(list)) {
        const uploaded = await uploadTouchFile(savedId, file);
        setFiles((current) => [...current, uploaded]);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof BbcApiError ? err.message : "Не удалось приложить файл");
    } finally {
      setUploading(false);
    }
  }

  async function removeFile(fileId: number) {
    try {
      await deleteTouchFile(fileId);
      setFiles((current) => current.filter((item) => item.id !== fileId));
      onSaved();
    } catch (err) {
      setError(err instanceof BbcApiError ? err.message : "Не удалось удалить файл");
    }
  }

  if (!open) return null;

  const canAttach = savedId != null && files.length < (options?.max_files ?? 5);

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
        aria-labelledby="touch-modal-title"
        tabIndex={-1}
        className="bbc-modal outline-none"
      >
        <div className="bbc-modal-head">
          <div className="min-w-0">
            <h2
              id="touch-modal-title"
              className="font-semibold truncate"
              style={{ color: "var(--text-primary)", fontSize: "var(--ios-title)" }}
            >
              {initial ? "Правка касания" : "Новое касание"}
            </h2>
            {savedId && !initial ? (
              <p className="text-xs mt-0.5" style={{ color: "var(--accent-emerald)" }}>
                Записано. Можно приложить подтверждение.
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

        <form onSubmit={submit} className="bbc-modal-body flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="eyebrow">Клиент</span>
            <select
              className="input-field"
              value={client}
              onChange={(event) => setClient(event.target.value)}
              required
              // Из реестра клиент уже известен — менять его тут не надо, это
              // почти наверняка промах, а не намерение.
              disabled={!!presetClient || !!initial}
            >
              <option value="" disabled>
                Выберите должника
              </option>
              {clients.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 min-w-0">
              <span className="eyebrow">Кому писали</span>
              <select
                className="input-field"
                value={contactRole}
                onChange={(event) => setContactRole(event.target.value)}
                required
              >
                {(options?.contact_roles ?? []).map((role) => (
                  <option key={role.key} value={role.key}>
                    {role.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5 min-w-0">
              <span className="eyebrow">Имя (необязательно)</span>
              <input
                className="input-field"
                value={contactName}
                onChange={(event) => setContactName(event.target.value)}
                placeholder="Айгуль Сатпаева"
                maxLength={120}
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 min-w-0">
              <span className="eyebrow">Когда</span>
              <input
                className="input-field"
                type="date"
                value={contactedAt}
                max={today()}
                onChange={(event) => setContactedAt(event.target.value)}
                required
              />
            </label>

            <label className="flex flex-col gap-1.5 min-w-0">
              <span className="eyebrow">Как</span>
              <select
                className="input-field"
                value={channel}
                onChange={(event) => setChannel(event.target.value)}
              >
                {(options?.channels ?? []).map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="eyebrow">К чему пришли</span>
            <textarea
              className="input-field"
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              rows={4}
              required
              placeholder="Обещали оплатить до пятницы. Просят акт сверки на почту."
              style={{ resize: "vertical", minHeight: "5rem" }}
            />
          </label>

          {/* Файлы. Раздел появляется только после сохранения: у файла внешний
              ключ на касание, и приложить его раньше физически некуда. */}
          <div className="flex flex-col gap-2">
            <span className="eyebrow">Подтверждение</span>

            {files.length ? (
              <ul className="flex flex-col gap-1.5">
                {files.map((file) => (
                  <li
                    key={file.id}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg min-w-0"
                    style={{ background: "var(--bg-active)" }}
                  >
                    <a
                      href={touchFileUrl(file.id)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 min-w-0 truncate text-xs"
                      style={{ color: "var(--text-accent)" }}
                    >
                      {file.filename}
                    </a>
                    <span className="bbc-micro bbc-num shrink-0" style={{ color: "var(--text-muted)" }}>
                      {Math.max(1, Math.round(file.size_bytes / 1024))} КБ
                    </span>
                    <button
                      type="button"
                      onClick={() => void removeFile(file.id)}
                      aria-label={`Удалить ${file.filename}`}
                      className="btn-ghost shrink-0 flex items-center justify-center"
                      style={{ width: 28, height: 28, padding: 0 }}
                    >
                      <CloseIcon size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            {savedId == null ? (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Сначала запишите касание — потом можно приложить скрин или документ.
              </p>
            ) : canAttach ? (
              <label className="btn-ghost text-xs px-3 py-2 inline-flex items-center gap-2 cursor-pointer self-start">
                <input
                  type="file"
                  multiple
                  className="sr-only"
                  accept="image/jpeg,image/png,image/webp,application/pdf,.docx"
                  onChange={(event) => {
                    void attach(event.target.files);
                    event.target.value = "";
                  }}
                  disabled={uploading}
                />
                {uploading ? "Загружаем…" : "Приложить скрин или документ"}
              </label>
            ) : (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Больше файлов приложить нельзя — предел {options?.max_files ?? 5}.
              </p>
            )}
          </div>

          {error ? (
            <p
              className="text-xs px-3 py-2 rounded-lg"
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

          <div className="flex items-center gap-2 pt-1">
            <button type="submit" className="btn-primary px-4 py-2.5" disabled={busy}>
              <CheckIcon size={15} />
              {busy ? "Сохраняем…" : savedId ? "Сохранить правки" : "Записать касание"}
            </button>
            <button type="button" className="btn-ghost px-4 py-2.5 text-xs" onClick={onClose}>
              {savedId ? "Готово" : "Отмена"}
            </button>
          </div>
        </form>
      </div>
    </>,
    document.body,
  );
}
