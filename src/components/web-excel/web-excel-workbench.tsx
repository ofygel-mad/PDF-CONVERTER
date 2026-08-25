"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { ArrowLeftIcon, ClockIcon, GridIcon } from "@/components/icons";
import { webExcelApi, type ImportStats, type SavedBook } from "./api";
import { ImportDialog } from "./import-dialog";
import { ensureSheetFonts } from "./sheet-fonts";
import { forgetSavedChoice, readSavedChoice, StartGate, type GateChoice } from "./start-gate";
import { blankWorkbook, UniverSheet, type UniverSheetHandle, type WorkbookSnapshot } from "./univer-sheet";

type Origin = { spreadsheetId: string; title: string; tabs: string[] } | null;

/**
 * Шрифты сохранённой книги — из её же реестра стилей.
 *
 * Отдельно списком они не хранятся намеренно: снимок и так самодостаточен, а
 * второй список рядом рано или поздно разошёлся бы с первым.
 */
function fontsOfSnapshot(snapshot: WorkbookSnapshot | null | undefined): string[] {
  const styles = snapshot?.styles;
  if (!styles || typeof styles !== "object") return [];
  const found = new Set<string>();
  for (const style of Object.values(styles as Record<string, { ff?: string }>)) {
    if (style?.ff) found.add(style.ff);
  }
  return [...found];
}

export function WebExcelWorkbench() {
  // `null` — ещё не решили, что показывать (первый кадр читает сохранённый
  // выбор). Пока решение не принято, ворота закрыты.
  const [choice, setChoice] = useState<GateChoice | null>(null);
  const [gateOpen, setGateOpen] = useState(true);
  const [importOpen, setImportOpen] = useState(false);

  const [workbook, setWorkbook] = useState<WorkbookSnapshot | null>(null);
  const [workbookKey, setWorkbookKey] = useState(0);
  const [name, setName] = useState("Новая таблица");
  const [origin, setOrigin] = useState<Origin>(null);
  const [bookId, setBookId] = useState<number | null>(null);

  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [stats, setStats] = useState<ImportStats[]>([]);
  const [saved, setSaved] = useState<SavedBook[]>([]);
  const [savedOpen, setSavedOpen] = useState(false);

  const sheetRef = useRef<UniverSheetHandle>(null);

  // Сохранённый выбор применяется в эффекте, а не при инициализации состояния:
  // localStorage на сервере нет, и чтение при рендере разошлось бы с разметкой,
  // которую Next отдал с сервера.
  useEffect(() => {
    const stored = readSavedChoice();
    if (!stored) return;
    setChoice(stored);
    setGateOpen(false);
    if (stored === "import") setImportOpen(true);
  }, []);

  const refreshSaved = useCallback(() => {
    webExcelApi
      .listBooks()
      .then((data) => setSaved(data.books))
      .catch(() => {
        /* список сохранённых книг — вспомогательный, его отказ не ломает экран */
      });
  }, []);

  useEffect(refreshSaved, [refreshSaved]);

  const onChoose = (next: GateChoice) => {
    setChoice(next);
    setGateOpen(false);
    if (next === "import") setImportOpen(true);
  };

  const doImport = async (spreadsheetId: string, tabs: string[], title: string) => {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const data = await webExcelApi.importBook(spreadsheetId, tabs);
      // Шрифты — до того, как книга попадёт в Univer: он меряет ширины текста
      // в момент первой отрисовки, и опоздавший шрифт уже ничего не исправит.
      await ensureSheetFonts(data.fonts ?? []);
      setWorkbook(data.workbook);
      setWorkbookKey((key) => key + 1);
      setName(data.title);
      setOrigin({ spreadsheetId, title, tabs: data.tabs });
      setBookId(null);
      setStats(data.stats);
      setImportOpen(false);
      setStatus("Импортировано из Google Sheets.");
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "Не удалось импортировать книгу");
    } finally {
      setBusy(false);
    }
  };

  const openSaved = async (id: number) => {
    setBusy(true);
    setError(null);
    try {
      const book = await webExcelApi.getBook(id);
      await ensureSheetFonts(fontsOfSnapshot(book.snapshot));
      setWorkbook(book.snapshot ?? blankWorkbook(book.name));
      setWorkbookKey((key) => key + 1);
      setName(book.name);
      setBookId(book.id);
      setOrigin(
        book.origin_spreadsheet_id
          ? {
              spreadsheetId: book.origin_spreadsheet_id,
              title: book.origin_title,
              tabs: book.origin_tabs,
            }
          : null,
      );
      setStats([]);
      setSavedOpen(false);
      setGateOpen(false);
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "Не удалось открыть книгу");
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    const snapshot = sheetRef.current?.snapshot();
    if (!snapshot) {
      setError("Таблица ещё не готова — попробуйте через секунду.");
      return;
    }
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const payload = {
        name: name.trim() || "Без названия",
        kind: origin ? "google" : "blank",
        origin_spreadsheet_id: origin?.spreadsheetId ?? "",
        origin_title: origin?.title ?? "",
        origin_tabs: origin?.tabs ?? [],
        snapshot,
      };
      const book = bookId
        ? await webExcelApi.updateBook(bookId, payload)
        : await webExcelApi.createBook(payload);
      setBookId(book.id);
      setStatus("Сохранено.");
      refreshSaved();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "Не удалось сохранить книгу");
    } finally {
      setSaving(false);
    }
  };

  const startBlank = () => {
    setWorkbook(null);
    setWorkbookKey((key) => key + 1);
    setName("Новая таблица");
    setOrigin(null);
    setBookId(null);
    setStats([]);
    setStatus(null);
    setGateOpen(false);
  };

  const reopenGate = () => {
    forgetSavedChoice();
    setChoice(null);
    setGateOpen(true);
    setImportOpen(false);
  };

  const truncated = stats.find((item) => item.truncated);

  return (
    <div className="we-shell">
      <header className="we-bar">
        <Link href="/" className="btn-ghost text-xs px-2.5 py-1.5 flex items-center gap-1.5">
          <ArrowLeftIcon size={15} />
          <span className="hidden sm:inline">Разделы</span>
        </Link>

        <input
          className="we-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Название таблицы"
          aria-label="Название таблицы"
        />

        {origin && (
          <span className="we-origin" title={`Импортировано из «${origin.title}»`}>
            {origin.title} · {origin.tabs.join(", ")}
          </span>
        )}

        <div className="we-bar-right">
          <button type="button" className="btn-ghost text-xs px-2.5 py-1.5" onClick={startBlank}>
            Новая
          </button>
          <button
            type="button"
            className="btn-ghost text-xs px-2.5 py-1.5 flex items-center gap-1.5"
            onClick={() => setImportOpen(true)}
          >
            <GridIcon size={15} />
            <span className="hidden sm:inline">Из Google</span>
          </button>
          <button
            type="button"
            className="btn-ghost text-xs px-2.5 py-1.5 flex items-center gap-1.5"
            onClick={() => {
              refreshSaved();
              setSavedOpen((open) => !open);
            }}
          >
            <ClockIcon size={15} />
            <span className="hidden sm:inline">Мои книги</span>
          </button>
          <button type="button" className="we-primary" disabled={saving} onClick={() => void save()}>
            {saving ? "Сохранение…" : bookId ? "Сохранить" : "Сохранить книгу"}
          </button>
        </div>
      </header>

      {/* Отказ — красным. Успех — обычным текстом: зелёная плашка «всё хорошо»
          на каждое сохранение превращается в шум, который перестают замечать
          ровно к тому моменту, когда он должен был напугать. */}
      {(error || status || truncated) && (
        <div className="we-note" data-error={error ? "true" : undefined}>
          {error ?? status}
          {!error && truncated && (
            <span className="we-note-extra">
              {" "}
              Показаны первые {truncated.rows} строк из {truncated.source_rows} — остальное
              осталось в Google.
            </span>
          )}
        </div>
      )}

      <div className="we-grid" data-blurred={gateOpen ? "true" : undefined}>
        <UniverSheet key={workbookKey} ref={sheetRef} data={workbook} />
      </div>

      {gateOpen && <StartGate onChoose={onChoose} />}

      {importOpen && (
        <ImportDialog
          busy={busy}
          onClose={() => {
            setImportOpen(false);
            // Отказ от импорта при закрытых воротах и пустом выборе вернул бы
            // человека в пустоту — поэтому ворота открываются заново.
            if (!workbook && choice === "import") setGateOpen(true);
          }}
          onImport={(id, tabs, title) => void doImport(id, tabs, title)}
        />
      )}

      {savedOpen && (
        <div className="we-modal-backdrop" onClick={() => setSavedOpen(false)}>
          <div className="we-modal" onClick={(event) => event.stopPropagation()}>
            <header className="we-modal-head">
              <span className="we-modal-title">Мои книги</span>
              <button type="button" className="btn-ghost text-xs px-2 py-1.5" onClick={reopenGate}>
                Спрашивать при входе
              </button>
            </header>
            <div className="we-modal-body">
              {saved.length === 0 && (
                <p className="we-modal-note">Пока ничего не сохранено.</p>
              )}
              {saved.map((book) => (
                <button
                  key={book.id}
                  type="button"
                  className="we-source-row"
                  onClick={() => void openSaved(book.id)}
                >
                  <span className="we-source-name">{book.name}</span>
                  <span className="we-source-meta">
                    {book.origin_title || "своя"} ·{" "}
                    {book.updated_at ? new Date(book.updated_at).toLocaleString("ru-RU") : ""}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
