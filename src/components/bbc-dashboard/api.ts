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

export function revokeLink(linkId: string): Promise<BbcOk> {
  return request<BbcOk>(`/links/${encodeURIComponent(linkId)}`, { method: "DELETE" });
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
