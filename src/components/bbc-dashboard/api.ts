/**
 * BBC Dashboard — the only place that talks to the backend.
 * All calls go through the Next proxy at /api/backend (see src/app/api/backend).
 *
 * Referral-link callers arrive at /bbc-dashboard?k=<token>. The token is replayed
 * as a header on every request so it stays out of the visible URL of API calls;
 * the backend resolves it into a server-side scope.
 */
import type {
  BbcCalendar,
  BbcCalendarMethod,
  BbcDataset,
  BbcEmployeeAlias,
  BbcEmployeeCreated,
  BbcEmployeeForm,
  BbcEmployeesPayload,
  BbcJournalPayload,
  BbcLink,
  BbcMe,
  BbcMsfoExport,
  BbcOk,
  BbcRevision,
  BbcSalesReport,
  BbcSheetInfo,
  BbcSnapshot,
  BbcStatus,
  BbcTouch,
  BbcTouchFile,
  BbcTouchForm,
  BbcTouchOptions,
  BbcWarning,
  BbcWarningsSummary,
} from "./types";

const BASE = "/api/backend/api/v1/bbc";
const LINK_HEADER = "X-BBC-Link";
export const LINK_PARAM = "k";

/** Reads the link token from the current URL, if the visitor came through one. */
export function currentLinkToken(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(LINK_PARAM);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = currentLinkToken();
  const headers: Record<string, string> = { ...((init?.headers as Record<string, string>) ?? {}) };
  if (init?.body) headers["Content-Type"] = "application/json";
  if (token) headers[LINK_HEADER] = token;

  const res = await fetch(`${BASE}${path}`, {
    cache: "no-store",
    credentials: "include",
    ...init,
    headers,
  });

  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const detail =
      payload && typeof payload === "object" && "detail" in payload
        ? String((payload as { detail: unknown }).detail)
        : `Ошибка ${res.status}`;
    throw new BbcApiError(detail, res.status);
  }
  return payload as T;
}

export class BbcApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "BbcApiError";
    this.status = status;
  }

  /** True when the caller simply is not signed in — the shell shows the login. */
  get isUnauthorized(): boolean {
    return this.status === 401;
  }
}

/* ── Access ─────────────────────────────────────────────────────────────────── */

export function fetchMe(): Promise<BbcMe> {
  return request<BbcMe>("/me");
}

export function login(username: string, password: string): Promise<BbcMe> {
  return request<BbcMe>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function logout(): Promise<BbcOk> {
  return request<BbcOk>("/auth/logout", { method: "POST" });
}

export function changeCredentials(body: {
  current_password: string;
  new_username?: string;
  new_password?: string;
}): Promise<BbcOk> {
  return request<BbcOk>("/account/credentials", { method: "POST", body: JSON.stringify(body) });
}

export function fetchLinks(): Promise<BbcLink[]> {
  return request<BbcLink[]>("/links");
}

export function createLink(department: string, expiresInHours?: number | null): Promise<BbcLink> {
  return request<BbcLink>("/links", {
    method: "POST",
    body: JSON.stringify({ department, expires_in_hours: expiresInHours ?? null }),
  });
}

/**
 * Сделать выданную ссылку временной — или снова бессрочной.
 *
 * Именно смена срока, а не перевыпуск: адрес остаётся прежним, поэтому у того,
 * кому ссылку уже отправили, ничего не ломается.
 */
export function updateLinkExpiry(linkId: string, minutes: number | null): Promise<BbcLink> {
  return request<BbcLink>(`/links/${encodeURIComponent(linkId)}`, {
    method: "PATCH",
    body: JSON.stringify({ expires_in_minutes: minutes }),
  });
}

export function revokeLink(linkId: string): Promise<BbcOk> {
  return request<BbcOk>(`/links/${encodeURIComponent(linkId)}`, { method: "DELETE" });
}

/* ── Сотрудники ─────────────────────────────────────────────────────────────── */

export function fetchEmployees(): Promise<BbcEmployeesPayload> {
  return request<BbcEmployeesPayload>("/employees");
}

/**
 * Написания из колонки «Сотрудник» — чтобы привязать учётку к её клиентам.
 * Каждое приходит со своими отделами и числом клиентов: без этого админ
 * собирает учётку вслепую и может выдать отдел, в котором этого человека нет.
 */
export function fetchEmployeeAliases(): Promise<{ names: BbcEmployeeAlias[] }> {
  return request<{ names: BbcEmployeeAlias[] }>("/employees/aliases");
}

export function createEmployee(form: BbcEmployeeForm): Promise<BbcEmployeeCreated> {
  return request<BbcEmployeeCreated>("/employees", {
    method: "POST",
    body: JSON.stringify(form),
  });
}

export function updateEmployee(id: number, form: BbcEmployeeForm): Promise<BbcEmployeeCreated["employee"]> {
  return request<BbcEmployeeCreated["employee"]>(`/employees/${id}`, {
    method: "PATCH",
    body: JSON.stringify(form),
  });
}

export function resetEmployeePassword(id: number): Promise<BbcEmployeeCreated> {
  return request<BbcEmployeeCreated>(`/employees/${id}/reset-password`, { method: "POST" });
}

export function dismissEmployee(id: number): Promise<BbcEmployeeCreated["employee"]> {
  return request<BbcEmployeeCreated["employee"]>(`/employees/${id}/dismiss`, { method: "POST" });
}

export function restoreEmployee(id: number): Promise<BbcEmployeeCreated> {
  return request<BbcEmployeeCreated>(`/employees/${id}/restore`, { method: "POST" });
}

export function deleteEmployee(id: number): Promise<BbcOk> {
  return request<BbcOk>(`/employees/${id}`, { method: "DELETE" });
}

/** Смена собственного пароля — в том числе принудительная при первом входе. */
export function setOwnPassword(currentPassword: string, newPassword: string): Promise<BbcOk> {
  return request<BbcOk>("/auth/set-password", {
    method: "POST",
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
}

/* ── Касания ────────────────────────────────────────────────────────────────── */

export function fetchTouchOptions(): Promise<BbcTouchOptions> {
  return request<BbcTouchOptions>("/touches/options");
}

export function fetchTouches(filters: {
  client?: string;
  authorId?: number | null;
  contactRole?: string;
  dateFrom?: string;
  dateTo?: string;
} = {}): Promise<BbcTouch[]> {
  const params = new URLSearchParams();
  if (filters.client) params.set("client", filters.client);
  if (filters.authorId != null) params.set("author_id", String(filters.authorId));
  if (filters.contactRole) params.set("contact_role", filters.contactRole);
  if (filters.dateFrom) params.set("date_from", filters.dateFrom);
  if (filters.dateTo) params.set("date_to", filters.dateTo);
  const query = params.toString();
  return request<BbcTouch[]>(`/touches${query ? `?${query}` : ""}`);
}

/**
 * Карта «клиент → сколько касаний» для значков в реестре дебиторки.
 *
 * Отдельным лёгким запросом, а не полем в /dataset: реестр открывают гораздо
 * чаще, чем журнал, и таскать в нём тексты всех касаний незачем.
 */
export function fetchTouchCounts(): Promise<{ counts: Record<string, number> }> {
  return request<{ counts: Record<string, number> }>("/touches/counts");
}

export function createTouch(form: BbcTouchForm): Promise<BbcTouch> {
  return request<BbcTouch>("/touches", { method: "POST", body: JSON.stringify(form) });
}

export function updateTouch(id: number, form: BbcTouchForm): Promise<BbcTouch> {
  return request<BbcTouch>(`/touches/${id}`, { method: "PATCH", body: JSON.stringify(form) });
}

export function deleteTouch(id: number): Promise<BbcOk> {
  return request<BbcOk>(`/touches/${id}`, { method: "DELETE" });
}

/**
 * Загрузка файла — единственный запрос с multipart, поэтому мимо `request()`:
 * тот навязывает `Content-Type: application/json`, а здесь границу multipart
 * должен проставить сам браузер.
 */
export async function uploadTouchFile(touchId: number, file: File): Promise<BbcTouchFile> {
  const token = currentLinkToken();
  const body = new FormData();
  body.append("file", file);

  const res = await fetch(`${BASE}/touches/${touchId}/files`, {
    method: "POST",
    cache: "no-store",
    credentials: "include",
    headers: token ? { [LINK_HEADER]: token } : undefined,
    body,
  });

  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const detail =
      payload && typeof payload === "object" && "detail" in payload
        ? String((payload as { detail: unknown }).detail)
        : `Ошибка ${res.status}`;
    throw new BbcApiError(detail, res.status);
  }
  return payload as BbcTouchFile;
}

export function deleteTouchFile(fileId: number): Promise<BbcOk> {
  return request<BbcOk>(`/files/${fileId}`, { method: "DELETE" });
}

/**
 * Адрес файла. Скачивание идёт через свой эндпоинт с проверкой прав, а не
 * ссылкой на бакет: скрин переписки о долге не должен открываться по угаданному
 * или пересланному адресу.
 */
export function touchFileUrl(fileId: number): string {
  const token = currentLinkToken();
  // Токен ссылки здесь приходится вернуть в URL: <a href> и <img src> заголовок
  // X-BBC-Link поставить не могут.
  return `${BASE}/files/${fileId}${token ? `?k=${encodeURIComponent(token)}` : ""}`;
}

/* ── Data ───────────────────────────────────────────────────────────────────── */

export function fetchDataset(refresh = false): Promise<BbcDataset> {
  return request<BbcDataset>(`/dataset${refresh ? "?refresh=true" : ""}`);
}

/** Tiny poll: served from backend memory, never touches Google. */
export function fetchRevision(): Promise<BbcRevision> {
  return request<BbcRevision>("/revision");
}

export function fetchCalendar(method: BbcCalendarMethod): Promise<BbcCalendar> {
  return request<BbcCalendar>(`/calendar?method=${encodeURIComponent(method)}`);
}

export function fetchSales(worksheet?: string): Promise<BbcSalesReport> {
  return request<BbcSalesReport>(`/sales${worksheet ? `?worksheet=${encodeURIComponent(worksheet)}` : ""}`);
}

export function fetchJournal(group: string, measure: string): Promise<BbcJournalPayload> {
  const params = new URLSearchParams({ group, measure });
  return request<BbcJournalPayload>(`/journal?${params.toString()}`);
}

export function exportMsfo(): Promise<BbcMsfoExport> {
  return request<BbcMsfoExport>("/export/msfo", { method: "POST" });
}

export function fetchWarnings(): Promise<{ warnings: BbcWarning[]; summary: BbcWarningsSummary }> {
  return request<{ warnings: BbcWarning[]; summary: BbcWarningsSummary }>("/warnings");
}

export function fetchStatus(): Promise<BbcStatus> {
  return request<BbcStatus>("/status");
}

export function fetchSheets(): Promise<BbcSheetInfo[]> {
  return request<BbcSheetInfo[]>("/sheets");
}

export function fetchSnapshot(worksheet?: string, refresh = false): Promise<BbcSnapshot> {
  const params = new URLSearchParams();
  if (worksheet) params.set("worksheet", worksheet);
  if (refresh) params.set("refresh", "true");
  const query = params.toString();
  return request<BbcSnapshot>(`/snapshot${query ? `?${query}` : ""}`);
}
