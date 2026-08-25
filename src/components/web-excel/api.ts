const API = "/api/backend/api/v1/web-excel";

export type SourceBook = { id: string; name: string; modified: string };
export type SourceTab = {
  sheet_id: number;
  title: string;
  index: number;
  hidden: boolean;
  rows: number;
  cols: number;
};
export type SourceMeta = { id: string; title: string; tabs: SourceTab[] };

export type ImportStats = {
  name: string;
  rows: number;
  cols: number;
  styles: number;
  merges: number;
  truncated: boolean;
  source_rows: number;
  source_cols: number;
};

export type SavedBook = {
  id: number;
  name: string;
  kind: string;
  origin_spreadsheet_id: string;
  origin_title: string;
  origin_tabs: string[];
  note: string;
  created_at: string | null;
  updated_at: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  snapshot?: Record<string, any>;
};

/**
 * Ошибка бэкенда разворачивается в текст до того, как попадёт наверх.
 *
 * FastAPI кладёт человеческую формулировку в `detail`, и именно её просили
 * показывать («у сервисного аккаунта нет доступа», «Google ограничил чтение»).
 * Без этого на экран попадало бы «HTTP 502» — фраза, по которой нельзя понять
 * ни что случилось, ни пройдёт ли оно само.
 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json", ...init?.headers } : init?.headers,
  });
  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const body = await response.json();
      if (typeof body?.detail === "string") detail = body.detail;
    } catch {
      /* тело не JSON — остаётся код статуса */
    }
    throw new Error(detail);
  }
  return (await response.json()) as T;
}

export const webExcelApi = {
  sources: () => request<{ books: SourceBook[] }>("/sources"),
  sourceMeta: (id: string) => request<SourceMeta>(`/sources/${id}`),
  refreshSources: () => request<{ ok: boolean }>("/sources/refresh", { method: "POST" }),
  importBook: (spreadsheetId: string, tabs: string[]) =>
    request<{
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      workbook: Record<string, any>;
      stats: ImportStats[];
      fonts: string[];
      tabs: string[];
      title: string;
    }>("/import", {
      method: "POST",
      body: JSON.stringify({ spreadsheet_id: spreadsheetId, tabs }),
    }),
  listBooks: () => request<{ books: SavedBook[] }>("/books"),
  getBook: (id: number) => request<SavedBook>(`/books/${id}`),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createBook: (payload: Record<string, any>) =>
    request<SavedBook>("/books", { method: "POST", body: JSON.stringify(payload) }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateBook: (id: number, payload: Record<string, any>) =>
    request<SavedBook>(`/books/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteBook: (id: number) => request<{ ok: boolean }>(`/books/${id}`, { method: "DELETE" }),
};
