"use client";

import { useEffect, useMemo, useState } from "react";

import { CloseIcon, RefreshIcon } from "@/components/icons";
import { webExcelApi, type SourceBook, type SourceMeta } from "./api";

type Props = {
  onClose: () => void;
  onImport: (spreadsheetId: string, tabs: string[], title: string) => void;
  busy: boolean;
  /** Текст хода загрузки, пока идёт импорт: «вкладка 7 из 23». */
  progress?: string | null;
};

/**
 * Сколько примерно займёт импорт. Восемь секунд на вкладку — не запас «на
 * всякий случай», а замер на «Журнале»: 2000 строк на 32 колонки Google отдаёт
 * за восемь секунд.
 *
 * Оценка нужна, потому что кнопка «отметить все» на книге с 23 вкладками
 * запускает трёхминутное ожидание. Человек имеет право узнать об этом до того,
 * как нажмёт, а не после.
 */
function estimate(count: number): string {
  const seconds = count * 8;
  if (seconds < 60) return `около ${seconds} секунд`;
  const minutes = Math.round(seconds / 60);
  // «Около» требует родительного падежа: около одной минуты, около трёх минут.
  // Не «около 3 минуты», как выходило по привычному правилу для 2–4.
  return `около ${minutes} ${minutes === 1 ? "минуты" : "минут"}`;
}

/**
 * Выбор книги и вкладок для импорта.
 *
 * Вкладки выбираются поштучно и по умолчанию отмечена одна — первая видимая.
 * Это не осторожность ради осторожности: ответ Google с оформлением весит
 * около 45 МБ на вкладку, «Журнал» состоит из восьми, и «импортировать всё
 * сразу» означало бы держать треть гигабайта в памяти контейнера и минуту
 * ждать пустой экран.
 */
export function ImportDialog({ onClose, onImport, busy, progress }: Props) {
  const [books, setBooks] = useState<SourceBook[] | null>(null);
  const [meta, setMeta] = useState<SourceMeta | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    webExcelApi
      .sources()
      .then((data) => {
        if (alive) setBooks(data.books);
      })
      .catch((exc: Error) => {
        if (alive) setError(exc.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle || !books) return books ?? [];
    return books.filter((book) => book.name.toLowerCase().includes(needle));
  }, [books, query]);

  const openBook = async (book: SourceBook) => {
    setError(null);
    setLoading(true);
    setMeta(null);
    try {
      const data = await webExcelApi.sourceMeta(book.id);
      setMeta(data);
      const first = data.tabs.find((tab) => !tab.hidden) ?? data.tabs[0];
      setSelected(first ? [first.title] : []);
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "Не удалось открыть книгу");
    } finally {
      setLoading(false);
    }
  };

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      await webExcelApi.refreshSources();
      const data = await webExcelApi.sources();
      setBooks(data.books);
      setMeta(null);
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "Не удалось обновить список");
    } finally {
      setLoading(false);
    }
  };

  const toggle = (title: string) => {
    setSelected((current) =>
      current.includes(title) ? current.filter((t) => t !== title) : [...current, title],
    );
  };

  return (
    <div className="we-modal-backdrop" role="dialog" aria-modal="true" aria-label="Импорт из Google Sheets">
      <div className="we-modal">
        <header className="we-modal-head">
          <span className="we-modal-title">
            {meta ? meta.title : "Книги Google Sheets"}
          </span>
          <button type="button" className="btn-ghost px-2 py-1.5" onClick={refresh} title="Обновить список">
            <RefreshIcon size={15} />
          </button>
          <button type="button" className="btn-ghost px-2 py-1.5" onClick={onClose} aria-label="Закрыть">
            <CloseIcon size={15} />
          </button>
        </header>

        {error && <div className="we-modal-error">{error}</div>}

        {!meta ? (
          <>
            <div className="we-modal-search">
              <input
                className="input-field"
                placeholder="Поиск по названию"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <div className="we-modal-body">
              {loading && <p className="we-modal-note">Спрашиваем Google…</p>}
              {!loading && filtered.length === 0 && (
                <p className="we-modal-note">
                  Ни одной книги не найдено. Таблицу нужно открыть сервисному аккаунту
                  bbc-sheets@bbc-sheets.iam.gserviceaccount.com
                </p>
              )}
              {filtered.map((book) => (
                <button
                  key={book.id}
                  type="button"
                  className="we-source-row"
                  onClick={() => void openBook(book)}
                >
                  <span className="we-source-name">{book.name}</span>
                  <span className="we-source-meta">
                    {book.modified ? new Date(book.modified).toLocaleDateString("ru-RU") : ""}
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            {/* Переключатель стоит НАД списком, а не в подвале рядом с
                «Импортировать»: он относится к списку и меняет его, а не
                запускает импорт. В подвале его легко нажать вместо кнопки
                импорта, и на книге с 23 вкладками это стоило бы человеку всей
                проставленной галочками работы. */}
            <div className="we-tabs-bar">
              <span className="we-modal-note">
                Вкладок {meta.tabs.length} · выбрано {selected.length}
              </span>
              <button
                type="button"
                className="btn-ghost text-xs px-2.5 py-1"
                onClick={() =>
                  setSelected(
                    selected.length === meta.tabs.length ? [] : meta.tabs.map((t) => t.title),
                  )
                }
              >
                {selected.length === meta.tabs.length ? "Снять все" : "Отметить все"}
              </button>
            </div>
            <div className="we-modal-body">
              {meta.tabs.map((tab) => (
                <label key={tab.title} className="we-tab-row">
                  <input
                    type="checkbox"
                    checked={selected.includes(tab.title)}
                    onChange={() => toggle(tab.title)}
                  />
                  <span className="we-source-name">{tab.title}</span>
                  <span className="we-source-meta">
                    {tab.rows} × {tab.cols}
                    {tab.hidden ? " · скрыт" : ""}
                  </span>
                </label>
              ))}
            </div>
            <footer className="we-modal-foot">
              <button type="button" className="btn-ghost text-xs px-3 py-1.5" onClick={() => setMeta(null)}>
                ← К списку книг
              </button>
              <span className="we-modal-note">
                {busy
                  ? progress
                  : selected.length > 2
                    ? `Займёт ${estimate(selected.length)} — вкладки читаются по одной`
                    : ""}
              </span>
              <button
                type="button"
                className="we-primary"
                disabled={busy || selected.length === 0}
                onClick={() => onImport(meta.id, selected, meta.title)}
              >
                {busy ? "Импортируем…" : `Импортировать (${selected.length})`}
              </button>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
