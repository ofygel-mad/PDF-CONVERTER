"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { booksApi, type Preview, type SourceBook, type SourceTab } from "@/components/books/api";
import { useScrollLock } from "@/components/use-scroll-lock";

/**
 * Импорт книги из Google — в три шага, и ни один не применяется молча.
 *
 *   выбор книги → выбор вкладки → предпросмотр → подтверждение
 *
 * Предпросмотр здесь не вежливость, а устройство: он показывает, сколько строк
 * добавится, сколько обновится и где книга разошлась с нашей копией. Импорт,
 * применяющийся сразу, однажды отзеркалит чью-то пересортировку и объявит это
 * тысячей осмысленных правок.
 *
 * Между предпросмотром и подтверждением сервер перечитывает книгу и сверяет
 * план с показанным. Разошлись — отказ: соглашались не на это.
 */

type Props = {
  open: boolean;
  onClose: () => void;
  onImported: (tableId: string) => void;
};

type Step = "book" | "tab" | "preview";

export function ImportDialog({ open, onClose, onImported }: Props) {
  const [step, setStep] = useState<Step>("book");
  const [books, setBooks] = useState<SourceBook[]>([]);
  const [filter, setFilter] = useState("");
  const [book, setBook] = useState<SourceBook | null>(null);
  const [tabs, setTabs] = useState<SourceTab[]>([]);
  const [tab, setTab] = useState<string>("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const panel = useRef<HTMLDivElement>(null);

  useScrollLock(open);

  useEffect(() => {
    if (!open) return;
    setStep("book");
    setBook(null);
    setTab("");
    setPreview(null);
    setError("");
    setBusy(true);
    booksApi
      .sources()
      .then((data) => setBooks(data.books))
      .catch((err) => setError(err instanceof Error ? err.message : "Не удалось получить список книг"))
      .finally(() => setBusy(false));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function chooseBook(item: SourceBook) {
    setBook(item);
    setBusy(true);
    setError("");
    try {
      const meta = await booksApi.sourceTabs(item.id);
      setTabs(meta.tabs);
      setStep("tab");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось прочитать книгу");
    } finally {
      setBusy(false);
    }
  }

  async function runPreview(tabTitle: string) {
    if (!book) return;
    setTab(tabTitle);
    setBusy(true);
    setError("");
    try {
      const result = await booksApi.preview(book.id, tabTitle);
      setPreview(result);
      setStep("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось прочитать вкладку");
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!book || !preview) return;
    setBusy(true);
    setError("");
    try {
      const result = await booksApi.apply(book.id, tab, preview.run_id);
      onImported(result.table_id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось применить импорт");
    } finally {
      setBusy(false);
    }
  }

  const shown = books.filter((item) =>
    item.title.toLowerCase().includes(filter.trim().toLowerCase()),
  );

  // Разметка повторяет `blocks/touches/touch-modal.tsx`: подложка — отдельный
  // элемент, `.bbc-modal` — сама панель. Обёртка с этим классом выглядела бы
  // так же, но затемнения бы не было: правило позиционирует панель, а не фон.
  return createPortal(
    <>
      <button
        type="button"
        aria-label="Закрыть"
        onClick={onClose}
        className="fixed inset-0 z-50"
        style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)" }}
      />
      <div
        className="bbc-modal bk-import"
        role="dialog"
        aria-modal="true"
        aria-label="Импорт книги из Google"
        ref={panel}
      >
        <div className="bbc-modal-head">
          <h2>
            {step === "book" && "Выберите книгу"}
            {step === "tab" && (book?.title ?? "Выберите вкладку")}
            {step === "preview" && "Что изменится"}
          </h2>
          <button className="btn-ghost text-xs px-2.5 py-1.5" onClick={onClose}>
            Закрыть
          </button>
        </div>

        <div className="bbc-modal-body">
          {error && (
            <p className="bk-error" role="alert">
              {error}
            </p>
          )}

          {step === "book" && (
            <>
              <input
                className="input-field bk-filter"
                placeholder="Поиск по названию"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                autoFocus
              />
              {busy && <p className="bk-hint">Спрашиваем Google…</p>}
              <ul className="bk-pick">
                {shown.map((item) => (
                  <li key={item.id}>
                    <button onClick={() => chooseBook(item)} disabled={busy}>
                      {item.title}
                    </button>
                  </li>
                ))}
              </ul>
              {!busy && shown.length === 0 && (
                <p className="bk-hint">
                  Ничего не нашлось. Книга должна быть расшарена сервисному
                  аккаунту хотя бы на чтение.
                </p>
              )}
            </>
          )}

          {step === "tab" && (
            <>
              <p className="bk-hint">
                Вкладки читаются по одной. Большая вкладка занимает несколько
                секунд — квота Google одна на всё приложение.
              </p>
              <ul className="bk-pick">
                {tabs.map((item) => (
                  <li key={item.id}>
                    <button onClick={() => runPreview(item.title)} disabled={busy}>
                      <span>{item.title}</span>
                      <span className="bk-pick-note">
                        {item.rows}×{item.cols}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {busy && <p className="bk-hint">Читаем вкладку и считаем, что изменится…</p>}
            </>
          )}

          {step === "preview" && preview && (
            <div className="bk-preview">
              {preview.blocked ? (
                <p className="bk-error" role="alert">
                  {preview.blocked_reason}
                </p>
              ) : (
                <p className="bk-preview-line">{preview.describe}</p>
              )}

              <dl className="bk-preview-stats">
                {Object.entries({
                  "новых строк": preview.summary.create ?? 0,
                  "обновится": preview.summary.update ?? 0,
                  "без изменений": preview.summary.unchanged ?? 0,
                  "расхождений": preview.summary.conflict ?? 0,
                  "пропали из книги": preview.summary.missing ?? 0,
                })
                  .filter(([, value]) => value)
                  .map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
              </dl>

              {preview.issues.length > 0 && (
                <div className="bk-issues">
                  <h4>Вопросы к книге</h4>
                  <ul>
                    {preview.issues.slice(0, 8).map((issue, index) => (
                      <li key={index}>
                        {String(issue.detail?.message ?? issue.kind)}
                      </li>
                    ))}
                  </ul>
                  {preview.issues.length > 8 && (
                    <p className="bk-hint">…и ещё {preview.issues.length - 8}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {step === "preview" && preview && !preview.blocked && (
          <div className="bk-import-foot">
            <button className="btn-ghost" onClick={() => setStep("tab")} disabled={busy}>
              Назад
            </button>
            <button className="btn-primary" onClick={confirm} disabled={busy}>
              {busy ? "Применяем…" : "Применить"}
            </button>
          </div>
        )}
      </div>
    </>,
    document.body,
  );
}
