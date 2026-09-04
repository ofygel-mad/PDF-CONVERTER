"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import {
  booksApi,
  TYPE_LABEL,
  type Board,
  type Book,
  type TableView,
} from "@/components/books/api";
import { BindingBoard } from "@/components/books/binding-board";
import { ImportDialog } from "@/components/books/import-dialog";
import { ArrowLeftIcon, GridIcon, RefreshIcon } from "@/components/icons";

/**
 * Раздел «Книги» — внутренние книги компании.
 *
 * Здесь книги, импортированные из Google, живут как типизированные строки, а
 * не как снимок ячеек. Над ними две поверхности: грид для тех, кому привычна
 * таблица, и формы дашборда для тех, кому привычно приложение. Считает из них
 * дашборд.
 *
 * Отдельно от «Таблиц» намеренно: там снимок книги одним блобом, без структуры
 * и идентичности строк, — черновик. Здесь строки, роли и права.
 */

type View = "rows" | "board";

export function BooksClient() {
  const [books, setBooks] = useState<Book[]>([]);
  const [tableId, setTableId] = useState<string>("");
  const [table, setTable] = useState<TableView | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [view, setView] = useState<View>("board");
  const [importing, setImporting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadBooks = useCallback(async () => {
    try {
      const data = await booksApi.books();
      setBooks(data.books);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось получить список книг");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBooks();
  }, [loadBooks]);

  const openTable = useCallback(async (id: string) => {
    setTableId(id);
    setError("");
    try {
      const [view, boardData] = await Promise.all([
        booksApi.table(id, 50),
        booksApi.board(id),
      ]);
      setTable(view);
      setBoard(boardData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось открыть вкладку");
    }
  }, []);

  return (
    <div className="bk-shell">
      <header className="bk-header">
        <div className="bk-header-left">
          <Link href="/services" className="btn-ghost text-xs px-2.5 py-1.5 flex items-center gap-1.5">
            <ArrowLeftIcon size={15} />
            <span className="only-desktop">Назад</span>
          </Link>
          <span className="logo-badge">
            <GridIcon size={16} />
          </span>
          <span className="bk-title">Книги</span>
        </div>
        <div className="bk-header-right">
          {tableId && (
            <button
              className="btn-ghost text-xs px-2.5 py-1.5 flex items-center gap-1.5"
              onClick={() => openTable(tableId)}
              title="Перечитать из базы"
            >
              <RefreshIcon size={15} />
              <span className="only-desktop">Обновить</span>
            </button>
          )}
          <button className="btn-primary text-xs px-3 py-1.5" onClick={() => setImporting(true)}>
            Импортировать из Google
          </button>
        </div>
      </header>

      {error && (
        <p className="bk-error bk-error-page" role="alert">
          {error}
        </p>
      )}

      {!loading && books.length === 0 && !error && (
        <div className="bk-empty">
          <h2>Пока ни одной книги</h2>
          <p>
            Импортируйте книгу из Google — приложение само разберёт колонки,
            определит их типы и предложит, какая из них какую величину означает.
            Ничего не применяется без вашего подтверждения.
          </p>
          <button className="btn-primary" onClick={() => setImporting(true)}>
            Импортировать из Google
          </button>
        </div>
      )}

      {books.length > 0 && (
        <div className="bk-body">
          <aside className="bk-side">
            {books.map((book) => (
              <BookCard key={book.id} book={book} onOpen={openTable} active={tableId} />
            ))}
          </aside>

          <main className="bk-main">
            {!tableId && (
              <p className="bk-hint bk-hint-center">
                Выберите вкладку слева.
              </p>
            )}

            {tableId && board && (
              <>
                <nav className="bk-tabs" aria-label="Что показывать">
                  <button
                    className={view === "board" ? "bk-tab bk-tab-on" : "bk-tab"}
                    onClick={() => setView("board")}
                  >
                    Табло привязок
                  </button>
                  <button
                    className={view === "rows" ? "bk-tab bk-tab-on" : "bk-tab"}
                    onClick={() => setView("rows")}
                  >
                    Строки{table ? ` · ${table.total}` : ""}
                  </button>
                </nav>

                {view === "board" && <BindingBoard board={board} onChange={setBoard} />}
                {view === "rows" && table && <RowsTable table={table} />}
              </>
            )}
          </main>
        </div>
      )}

      <ImportDialog
        open={importing}
        onClose={() => setImporting(false)}
        onImported={(id) => {
          loadBooks();
          openTable(id);
        }}
      />
    </div>
  );
}

function BookCard({
  book,
  onOpen,
  active,
}: {
  book: Book;
  onOpen: (tableId: string) => void;
  active: string;
}) {
  return (
    <div className="bk-book">
      <span className="bk-book-title">{book.title}</span>
      <span className="bk-book-note">
        {book.imported_at
          ? `импортирована ${new Date(book.imported_at).toLocaleDateString("ru-RU")}`
          : "ещё не импортирована"}
      </span>
      <ul className="bk-book-tabs">
        {/* Список, а не «список или что-то ещё»: неожиданная форма данных не
            должна ронять экран. Так уже вышло — бэкенд отдавал число вместо
            вкладок, и `.map` уронил вкладку браузера целиком. */}
        {(Array.isArray(book.tables) ? book.tables : []).map((tab) => (
          <li key={tab.id}>
            <button
              className={active === tab.id ? "bk-book-tab bk-book-tab-on" : "bk-book-tab"}
              onClick={() => onOpen(tab.id)}
            >
              {tab.name}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}


function RowsTable({ table }: { table: TableView }) {
  // Всё, что приходит с сервера, читается через запасное значение. Экран уже
  // дважды падал целиком оттого, что поле ответа оказалось не той формы: один
  // раз `tables` пришло числом вместо списка, другой — `role_titles` не было
  // вовсе. Ошибка в одной ячейке не должна стоить вкладки браузера.
  const fields = Array.isArray(table.fields) ? table.fields : [];
  const bindings = table.bindings ?? {};
  const titles = table.role_titles ?? {};
  const rows = Array.isArray(table.rows) ? table.rows : [];
  const shown = fields.filter((field) => !field.title.match(/^[.\-\s]*$/));
  return (
    <div className="bk-rows">
      <div className="bk-rows-scroll">
        <table>
          <thead>
            <tr>
              {shown.map((field) => (
                <th key={field.key}>
                  <span className="bk-col-title">{field.title}</span>
                  <span className="bk-col-type">
                    {bindings[field.key]
                      ? titles[bindings[field.key]] ?? bindings[field.key]
                      : TYPE_LABEL[field.type] ?? field.type}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                {shown.map((field) => (
                  <td key={field.key}>{String(row.values[field.key] ?? "")}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="bk-hint">
        Показаны первые {rows.length} строк из {table.total}. Колонки без
        роли остаются на месте — они просто не участвуют в расчётах.
      </p>
    </div>
  );
}
