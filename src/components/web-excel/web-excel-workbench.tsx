"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";

import { UniverSheet, type UniverSheetHandle, type WebExcelColumn } from "./univer-sheet";

const API = "/api/backend";

type PreviewVariant = {
  key: string;
  name: string;
  columns: WebExcelColumn[];
  rows: Array<Record<string, unknown>>;
  base_variant_key?: string | null;
  template_id?: string | null;
};

type PreviewResponse = {
  session_id: string;
  document: { parser_key: string; title?: string };
  variants: PreviewVariant[];
  saved_variants?: PreviewVariant[];
  default_variant_key?: string | null;
};

function norm(s: unknown): string {
  return String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function WebExcelWorkbench() {
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [gridKey, setGridKey] = useState(0);
  const sheetRef = useRef<UniverSheetHandle>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Pick the variant to display: the auto-matched/saved образ if present, else base.
  const active = useMemo<PreviewVariant | null>(() => {
    if (!preview) return null;
    const all = [...(preview.variants ?? []), ...(preview.saved_variants ?? [])];
    const byDefault = all.find((v) => v.key === preview.default_variant_key);
    return byDefault ?? preview.variants?.[0] ?? null;
  }, [preview]);

  const baseVariantKey = active?.base_variant_key ?? active?.key ?? "";

  async function upload(file: File) {
    setBusy(true); setError(null); setStatus(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${API}/api/v1/transforms/preview`, { method: "POST", body: fd });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as PreviewResponse;
      setPreview(data);
      setName(`${data.document.parser_key} — Web-Excel`);
      setGridKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки выписки.");
    } finally {
      setBusy(false);
    }
  }

  async function saveImage() {
    if (!preview || !active) return;
    const grid = sheetRef.current?.read();
    if (!grid || grid.length === 0) { setError("Пустая таблица."); return; }

    const headers = grid[0] ?? [];
    const labelToKey = new Map(active.columns.map((c) => [norm(c.label), c]));
    const columns = headers.map((h, j) => {
      const known = labelToKey.get(norm(h));
      if (known) return { key: known.key, label: known.label, kind: known.kind };
      const label = String(h ?? "").trim() || `Колонка ${j + 1}`;
      return { key: `col_${j}`, label, kind: "text" };
    }).filter((c, j) => String(headers[j] ?? "").trim() !== "");

    const rows: Array<Record<string, unknown>> = [];
    for (let i = 1; i < grid.length; i++) {
      const r = grid[i] ?? [];
      if (r.every((v) => v === null || v === undefined || v === "")) continue;
      const obj: Record<string, unknown> = {};
      columns.forEach((c, j) => { obj[c.key] = r[j] ?? ""; });
      rows.push(obj);
    }

    setSaving(true); setError(null); setStatus(null);
    try {
      const res = await fetch(`${API}/api/v1/transforms/web-excel/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: preview.session_id,
          base_variant_key: baseVariantKey,
          name: name.trim() || "Web-Excel",
          columns,
          rows,
          layout: { columns },
          is_default: true,
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `HTTP ${res.status}`);
      }
      const tpl = (await res.json()) as { template_id: string };
      try { localStorage.setItem(`template_id_${preview.document.parser_key}`, tpl.template_id); } catch { /* noop */ }
      setStatus("Образ сохранён — следующая такая выписка откроется в этом виде.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сохранения образа.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-screen flex-col" style={{ background: "var(--bg, #0b1220)", color: "var(--text, #e5e7eb)" }}>
      <header className="flex items-center gap-3 border-b px-4 py-2.5" style={{ borderColor: "var(--border, #1f2937)" }}>
        <Link href="/" className="btn-ghost text-xs px-2.5 py-1.5">← Назад</Link>
        <h1 className="text-sm font-semibold">Web-Excel</h1>
        <span className="text-xs" style={{ color: "var(--text-secondary, #94a3b8)" }}>
          {active ? `${active.name} · ${active.rows.length} строк` : "выписка как в Excel — правьте, считайте, сохраняйте образ"}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }}
          />
          <button type="button" className="btn-ghost text-xs px-3 py-1.5" disabled={busy}
            onClick={() => fileRef.current?.click()}>
            {busy ? "Загрузка…" : "Загрузить выписку"}
          </button>
          {preview && (
            <>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Название образа"
                className="rounded-md px-2 py-1.5 text-xs"
                style={{ background: "var(--bg-elevated, #111827)", border: "1px solid var(--border, #1f2937)", minWidth: 180 }}
              />
              <button type="button" className="rounded-full px-3 py-1.5 text-xs font-medium"
                style={{ background: "#fff", color: "#0b1220" }}
                disabled={saving} onClick={() => void saveImage()}>
                {saving ? "Сохранение…" : "Сохранить образ"}
              </button>
            </>
          )}
        </div>
      </header>

      {(error || status) && (
        <div className="px-4 py-1.5 text-xs" style={{ color: error ? "#f87171" : "#34d399" }}>
          {error ?? status}
        </div>
      )}

      <div className="relative flex-1">
        {active ? (
          <UniverSheet key={gridKey} ref={sheetRef} columns={active.columns} rows={active.rows} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center"
            style={{ color: "var(--text-secondary, #94a3b8)" }}>
            <p className="text-sm">Загрузите выписку (PDF) — она откроется в полноценной таблице.</p>
            <button type="button" className="rounded-full px-4 py-2 text-xs font-medium"
              style={{ background: "#fff", color: "#0b1220" }}
              disabled={busy} onClick={() => fileRef.current?.click()}>
              {busy ? "Загрузка…" : "Выбрать файл"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
