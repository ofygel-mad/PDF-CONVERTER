"use client";

import { useEffect, useMemo, useState } from "react";

import { booksApi, type Book, type TableView } from "@/components/books/api";
import { RecordModal } from "@/components/bbc-dashboard/blocks/registries/record-modal";

/**
 * Реестры — то, что заполняют в таблице, но здесь.
 *
 * Запись ложится во внутреннюю книгу — ту же самую, что открыта в разделе
 * «Книги». Один и тот же ряд виден и там, и тут: грид для тех, кому привычна
 * таблица, форма для тех, кому привычно приложение. Связка настоящая, потому
 * что данные одни, а не потому, что два экрана договорились.
 *
 * Отличие от журнала касаний, который стоит рядом в меню: касание живёт только
 * у нас и в книгах его нет вовсе. Здесь — наоборот.
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

type Props = {
  /** Писать может только вошедший: у ссылки отдела нет автора для подписи. */
  canWrite: boolean;
};

export function RegistriesBlock({ canWrite }: Props) {
  const [books, setBooks] = useState<Book[]>([]);
  // Выбранный реестр — не состояние, а вывод: пусто означает «первый из
  // списка». Присваивать его в эффекте пришлось бы после загрузки книг, а это
  // лишний проход отрисовки и повод для гонки, если книги приедут дважды.
  const [chosen, setChosen] = useState("");
  const [table, setTable] = useState<TableView | null>(null);
  const [editing, setEditing] = useState<TableView["rows"][number] | null>(null);
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    booksApi
      .books()
      .then((data) => setBooks(data.books))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Не удалось получить книги"),
      )
      .finally(() => setLoading(false));
  }, []);

  const registries = useMemo(
    () =>
      books.flatMap((book) =>
        (book.tables ?? []).map((tab) => ({
          id: tab.id,
          name: tab.name,
          book: book.title,
        })),
      ),
    [books],
  );

  const tableId = chosen || registries[0]?.id || "";

  useEffect(() => {
    if (!tableId) return;
    // Флаг отмены закрывает настоящую гонку: при быстром переключении реестров
    // ответ по прежнему мог прийти позже и затереть новый. Заодно исчезает
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
        setError(err instanceof Error ? err.message : "Не удалось открыть реестр");
      },
    );
    return () => {
      cancelled = true;
    };
  }, [tableId]);

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

  if (loading) return <p className="bbc-reg-hint">Читаем книги…</p>;

  if (registries.length === 0) {
    return (
      <div className="bbc-reg-empty">
        <h3>Реестров пока нет</h3>
        <p>
          Реестр — это вкладка внутренней книги. Импортируйте книгу в разделе
          «Книги», и она появится здесь: заполнять её можно будет и таблицей, и
          формой — записи общие.
        </p>
      </div>
    );
  }

  return (
    <div className="bbc-reg">
      <div className="bbc-reg-bar">
        <label className="bbc-reg-pick">
          <span className="sr-only">Реестр</span>
          <select
            className="input-field"
            value={tableId}
            onChange={(event) => setChosen(event.target.value)}
          >
            {registries.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} — {item.book}
              </option>
            ))}
          </select>
        </label>

        <input
          className="input-field bbc-reg-search"
          placeholder="Поиск по записям"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        {canWrite && (
          <button className="btn-primary text-xs px-3 py-1.5" onClick={() => setAdding(true)}>
            Добавить запись
          </button>
        )}
      </div>

      {error && (
        <p className="bbc-reg-error" role="alert">
          {error}
        </p>
      )}

      {table && (
        <>
          <p className="bbc-reg-hint">
            {search
              ? `Найдено ${rows.length} из ${table.rows.length} загруженных`
              : `Показаны ${table.rows.length} записей из ${table.total}`}
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
    </div>
  );
}
