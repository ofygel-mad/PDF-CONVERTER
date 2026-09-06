"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { booksApi, type Board, type Book, type TableView } from "@/components/books/api";
import { BindingBoard } from "@/components/books/binding-board";
import { ImportDialog } from "@/components/books/import-dialog";
import { RecordModal } from "@/components/bbc-dashboard/blocks/books/record-modal";

/**
 * «Книги» — единственное место, где живут внутренние копии книг компании.
 *
 * Почему раздел один, хотя раньше их было два
 * ───────────────────────────────────────────
 * Сначала я развёл ввод и разметку по разным поверхностям: страница `/books`
 * с колонками и гридом, и раздел «Реестры» в сайдбаре с формой. Данные там
 * были одни и те же, а названий у одного объекта получилось три — «книга»,
 * «реестр», «вкладка», — и связи между экранами не было видно ниоткуда.
 * Человек, открывший это впервые, не мог понять, зачем ему два списка одних и
 * тех же строк.
 *
 * Теперь поверхность одна, а разделение — по вкладкам внутри неё: «Записи» для
 * ежедневного ввода, «Колонки» для разметки, которую делают редко. Право
 * доступа осталось прежним (`registries`): у выданных учёток оно уже записано,
 * и переименование ключа отняло бы у них раздел.
 *
 * Отличие от журнала касаний, который стоит рядом в меню: касание живёт только
 * у нас, в книгах его нет вовсе. Здесь наоборот — запись ложится в книгу, из
 * которой дашборд считает цифры.
 */

/**
 * Роли в порядке того, насколько они помогают узнать запись.
 *
 * Порядок колонок в книге для этого не годится: в журнале первыми стоят «ДДС
 * Мес» и «ОПиУ период» — служебные величины для сводок, по которым человек не
 * отличит одну операцию от другой. Узнают запись по дате, контрагенту и сумме.
 */
const IDENTIFYING_ROLES = [
  "entry_date", "signed_at", "period_start", "invoice_date", "avr_date",
  "client", "counterparty", "contract_no", "invoice_no",
  "inflow", "outflow", "contract_amount", "paid_amount", "saldo_end", "debt",
  "account", "firm", "category", "subcategory", "status", "comment",
];

type View = "rows" | "columns";

type Props = {
  /** Писать может только вошедший: у ссылки отдела нет автора для подписи. */
  canWrite: boolean;
};

export function BooksBlock({ canWrite }: Props) {
  const [books, setBooks] = useState<Book[]>([]);
  // Выбранная вкладка — не состояние, а вывод: пусто означает «первая из
  // списка». Присваивать её в эффекте пришлось бы после загрузки книг, а это
  // лишний проход отрисовки и повод для гонки, если книги приедут дважды.
  const [chosen, setChosen] = useState("");
  const [view, setView] = useState<View>("rows");
  const [table, setTable] = useState<TableView | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [editing, setEditing] = useState<TableView["rows"][number] | null>(null);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadBooks = useCallback(
    () =>
      booksApi
        .books()
        .then((data) => setBooks(data.books))
        .catch((err) =>
          setError(err instanceof Error ? err.message : "Не удалось получить книги"),
        )
        .finally(() => setLoading(false)),
    [],
  );

  useEffect(() => {
    loadBooks();
  }, [loadBooks]);

  const tabs = useMemo(
    () =>
      books.flatMap((book) =>
        // Список, а не «список или что-то ещё»: неожиданная форма ответа не
        // должна ронять экран. Так уже выходило — бэкенд отдал число вместо
        // вкладок, и `.map` уронил вкладку браузера целиком.
        (Array.isArray(book.tables) ? book.tables : []).map((tab) => ({
          id: tab.id,
          name: tab.name,
          book: book.title,
          imported_at: book.imported_at,
        })),
      ),
    [books],
  );

  const tableId = chosen || tabs[0]?.id || "";
  const current = tabs.find((tab) => tab.id === tableId);

  useEffect(() => {
    if (!tableId) return;
    // Флаг отмены закрывает настоящую гонку: при быстром переключении вкладок
    // ответ по прежней мог прийти позже и затереть новую. Заодно исчезает
    // претензия линтера — состояние меняется в колбэке, а не в теле эффекта.
    let cancelled = false;
    booksApi.table(tableId, 200, 0, "recent").then(
      (next) => {
        if (cancelled) return;
        setTable(next);
        setError("");
      },
      (err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Не удалось открыть книгу");
      },
    );
    return () => {
      cancelled = true;
    };
  }, [tableId]);

  /**
   * Табло от прежней вкладки — не табло, а мусор. Свежесть выводится из самого
   * ответа, а не сбрасывается в эффекте: сброс состояния прямо в теле эффекта
   * запускает каскад отрисовок, и линтер справедливо на него ругается.
   */
  const boardHere = board && board.table.id === tableId ? board : null;

  /** Разметка читается только когда её открыли: на ежедневный ввод она не нужна. */
  useEffect(() => {
    if (view !== "columns" || !tableId || boardHere) return;
    let cancelled = false;
    booksApi.board(tableId).then(
      (next) => {
        if (!cancelled) setBoard(next);
      },
      (err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Не удалось прочитать разметку");
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [view, tableId, boardHere]);

  /** Колонки для показа — те, по которым запись узнают, а не первые попавшиеся. */
  const columns = useMemo(() => {
    if (!table) return [];
    const bindings = table.bindings ?? {};
    const fields = (table.fields ?? []).filter(
      (field) => !field.title.match(/^[.\-\s]*$/),
    );
    const bound = fields.filter((field) => bindings[field.key]);
    if (!bound.length) return fields.slice(0, 6);
    const rank = (key: string) => {
      const index = IDENTIFYING_ROLES.indexOf(bindings[key]);
      return index === -1 ? IDENTIFYING_ROLES.length : index;
    };
    return [...bound]
      .sort((a, b) => rank(a.key) - rank(b.key) || a.position - b.position)
      .slice(0, 6);
  }, [table]);

  const rows = useMemo(() => {
    if (!table) return [];
    const needle = search.trim().toLowerCase();
    if (!needle) return table.rows ?? [];
    return (table.rows ?? []).filter((row) =>
      Object.values(row.values ?? {}).some((value) =>
        String(value ?? "").toLowerCase().includes(needle),
      ),
    );
  }, [table, search]);

  const boundCount = useMemo(
    () => Object.keys(table?.bindings ?? {}).length,
    [table],
  );

  if (loading) return <p className="bbc-reg-hint">Читаем книги…</p>;

  return (
    <div className="bbc-reg">
      {/* ── Зачем этот раздел вообще существует ───────────────────────── */}
      <div className="bbc-reg-lede">
        <p>
          Таблицы <b>Google / Книга</b> в
          
        </p>
        <p className="bbc-reg-hint">
          
        </p>
      </div>

      {error && (
        <p className="bbc-reg-error" role="alert">
          {error}
        </p>
      )}

      {tabs.length === 0 ? (
        <div className="bbc-reg-empty">
          <h3>Пока ни одной книги</h3>
          <p>
            Привезите книгу из Google — приложение само разберёт колонки,
            определит их типы и предложит, какая из них какую величину означает.
            Ничего не применяется без подтверждения, и в исходную книгу ничего не
            записывается.
          </p>
          {canWrite && (
            <button className="btn-primary" onClick={() => setImporting(true)}>
              Привезти книгу из Google
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="bbc-reg-bar">
            <label className="bbc-reg-pick">
              <span className="sr-only">Книга и вкладка</span>
              <select
                className="input-field"
                value={tableId}
                onChange={(event) => {
                  setChosen(event.target.value);
                  setSearch("");
                }}
              >
                {tabs.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.book} — вкладка «{item.name}»
                  </option>
                ))}
              </select>
            </label>

            {canWrite && (
              <button
                className="btn-ghost text-xs px-3 py-1.5"
                onClick={() => setImporting(true)}
              >
                Привезти книгу из Google
              </button>
            )}
          </div>

          {current?.imported_at && (
            <p className="bbc-reg-hint">
              {/* Точку в конце не ставим: русская локаль уже заканчивает дату
                  на «г.», и получалось «5 сентября 2026 г..». */}
              Привезена{" "}
              {new Date(current.imported_at).toLocaleDateString("ru-RU", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          )}

          <nav className="bbc-reg-tabs" aria-label="Что показывать">
            <button
              className={view === "rows" ? "bbc-reg-tab bbc-reg-tab-on" : "bbc-reg-tab"}
              onClick={() => setView("rows")}
            >
              Записи{table ? ` · ${table.total}` : ""}
            </button>
            <button
              className={view === "columns" ? "bbc-reg-tab bbc-reg-tab-on" : "bbc-reg-tab"}
              onClick={() => setView("columns")}
            >
              Колонки
              {table ? ` · ${boundCount} из ${(table.fields ?? []).length}` : ""}
            </button>
          </nav>

          {view === "rows" && table && (
            <>
              <div className="bbc-reg-bar">
                <input
                  className="input-field bbc-reg-search"
                  placeholder="Поиск по записям"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
                {canWrite && (
                  <button
                    className="btn-primary text-xs px-3 py-1.5"
                    onClick={() => setAdding(true)}
                  >
                    Добавить запись
                  </button>
                )}
              </div>

              <p className="bbc-reg-hint">
                {search
                  ? `Найдено ${rows.length} из ${table.rows.length} загруженных`
                  : `Показаны ${table.rows.length} последних записей из ${table.total}`}
                {canWrite ? " · нажмите на строку, чтобы поправить" : ""}
              </p>

              <div className="bbc-reg-scroll">
                <table>
                  <thead>
                    <tr>
                      {columns.map((field) => (
                        <th key={field.key}>{field.title}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={row.id}
                        className={canWrite ? "bbc-reg-row-clickable" : undefined}
                        onClick={canWrite ? () => setEditing(row) : undefined}
                      >
                        {columns.map((field) => (
                          <td key={field.key}>{String(row.values?.[field.key] ?? "")}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {view === "columns" &&
            (boardHere ? (
              <BindingBoard board={boardHere} onChange={setBoard} />
            ) : (
              <p className="bbc-reg-hint">Читаем разметку…</p>
            ))}
        </>
      )}

      {table && (adding || editing) && (
        <RecordModal
          table={table}
          row={editing}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
          // Перечитываем прямо здесь, а не через эффект: это обработчик
          // события, и правило про setState в эффектах на него не
          // распространяется. Попытка обновлять сменой ключа не срабатывала —
          // повторного запроса после сохранения не уходило вовсе.
          onSaved={async () => {
            try {
              setTable(await booksApi.table(tableId, 200, 0, "recent"));
            } catch {
              /* список остаётся прежним; запись всё равно сохранена */
            }
          }}
        />
      )}

      <ImportDialog
        open={importing}
        onClose={() => setImporting(false)}
        onImported={(id) => {
          loadBooks();
          setChosen(id);
          setView("columns");
        }}
      />
    </div>
  );
}
