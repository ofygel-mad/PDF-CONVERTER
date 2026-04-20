"use client";

import { useRef, useState } from "react";

import type { ScanResponse } from "@/components/workbench/types";

type Props = {
  onClose: () => void;
  onSentToReview: (reviewId: string) => void;
  apiBase: string;
};

type UploadState = "idle" | "uploading" | "done" | "error";

export function ScannedUploadPanel({ onClose, onSentToReview, apiBase }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>("idle");
  const [result, setResult] = useState<ScanResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setState("uploading");
    setResult(null);
    setErrorMsg("");

    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch(`${apiBase}/api/v1/transforms/scan`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.detail || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as ScanResponse;
      setResult(data);
      setState("done");
    } catch (err) {
      setErrorMsg(String(err));
      setState("error");
    }
  };

  const handleDownloadDocx = () => {
    if (!result) return;
    window.open(`${apiBase}/api/v1/transforms/scan/${result.scan_id}/docx`, "_blank");
  };

  const handleSendToReview = async () => {
    if (!result) return;
    setIsSending(true);
    try {
      const res = await fetch(
        `${apiBase}/api/v1/transforms/scan/${result.scan_id}/to-review`,
        { method: "POST" }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      onSentToReview(data.review_id as string);
    } catch (err) {
      setErrorMsg(String(err));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(3px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-2xl rounded-2xl flex flex-col"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border-base)",
          maxHeight: "80vh",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: "var(--border-base)" }}
        >
          <div>
            <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              Сканированный документ
            </h3>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
              PDF, JPG, PNG, TIFF — OCR с выравниванием, удалением печатей и экспортом в Word
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-lg leading-none opacity-50 hover:opacity-100"
            style={{ color: "var(--text-primary)" }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Drop zone */}
          {state === "idle" && (
            <label
              className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed cursor-pointer py-10 gap-3 transition-opacity hover:opacity-80"
              style={{ borderColor: "var(--border-base)" }}
            >
              <span className="text-3xl">📄</span>
              <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Нажмите или перетащите файл
              </span>
              <span className="text-xs opacity-50" style={{ color: "var(--text-secondary)" }}>
                PDF · JPG · PNG · TIFF
              </span>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.tiff,.tif"
                className="sr-only"
                onChange={(e) => void handleFileChange(e)}
              />
            </label>
          )}

          {state === "uploading" && (
            <div className="text-center py-10 space-y-3">
              <div className="inline-block w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin opacity-60" />
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Обрабатываю сканированный документ…
              </p>
              <p className="text-xs opacity-50" style={{ color: "var(--text-secondary)" }}>
                Выравнивание · Удаление печатей · OCR · Распознавание таблиц
              </p>
            </div>
          )}

          {state === "error" && (
            <div
              className="rounded-xl px-4 py-3 text-sm"
              style={{ background: "var(--red-50, #fff5f5)", color: "var(--red-600, #dc2626)" }}
            >
              ✕ Ошибка: {errorMsg}
              <button
                className="ml-3 underline text-xs"
                onClick={() => setState("idle")}
              >
                Попробовать ещё раз
              </button>
            </div>
          )}

          {state === "done" && result && (
            <>
              {/* Meta */}
              <div
                className="rounded-xl px-4 py-3 space-y-1"
                style={{ background: "var(--bg-hover)" }}
              >
                <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  {result.meta.source_filename}
                </p>
                <div className="flex gap-4 text-xs" style={{ color: "var(--text-secondary)" }}>
                  <span>Страниц: {result.meta.page_count}</span>
                  <span>Таблиц: {result.meta.tables_found}</span>
                  <span>Уверенность: {(result.meta.avg_confidence * 100).toFixed(1)}%</span>
                </div>
                {result.meta.rotation_angles.some((a) => Math.abs(a) > 0.1) && (
                  <p className="text-xs opacity-60" style={{ color: "var(--text-secondary)" }}>
                    Повернуто: {result.meta.rotation_angles.map((a) => `${a.toFixed(1)}°`).join(", ")}
                  </p>
                )}
                {result.meta.warnings.length > 0 && (
                  <p
                    className="text-xs"
                    style={{ color: "var(--amber-500, #f59e0b)" }}
                  >
                    ⚠ {result.meta.warnings.join(" · ")}
                  </p>
                )}
              </div>

              {/* Preview tables */}
              {result.preview_tables.map((pt, i) => (
                <div key={i} className="space-y-1">
                  <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                    Стр. {pt.page} · уверенность {(pt.confidence * 100).toFixed(0)}%
                  </p>
                  <div className="overflow-x-auto rounded-lg">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr>
                          {pt.headers.map((h, hi) => (
                            <th
                              key={hi}
                              className="px-2 py-1 text-left font-semibold"
                              style={{
                                background: "var(--bg-hover)",
                                borderBottom: "1px solid var(--border-base)",
                                color: "var(--text-primary)",
                              }}
                            >
                              {h || `Колонка ${hi + 1}`}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {pt.rows.slice(0, 5).map((row, ri) => (
                          <tr key={ri}>
                            {row.map((cell, ci) => (
                              <td
                                key={ci}
                                className="px-2 py-1"
                                style={{
                                  borderBottom: "1px solid var(--border-base)",
                                  color: cell.startsWith("[?]")
                                    ? "var(--amber-500, #f59e0b)"
                                    : "var(--text-primary)",
                                }}
                              >
                                {cell || "—"}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {pt.rows.length > 5 && (
                      <p className="text-xs px-2 py-1 opacity-50" style={{ color: "var(--text-secondary)" }}>
                        + ещё {pt.rows.length - 5} строк
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Footer */}
        {state === "done" && result && (
          <div
            className="flex items-center justify-between gap-2 px-5 py-3 border-t"
            style={{ borderColor: "var(--border-base)" }}
          >
            <button
              className="btn-ghost px-3 py-1.5 text-xs"
              onClick={() => { setState("idle"); setResult(null); }}
            >
              ← Загрузить другой файл
            </button>
            <div className="flex gap-2">
              <button
                className="btn-ghost px-4 py-1.5 text-sm"
                onClick={handleDownloadDocx}
              >
                ⬇ Скачать Word
              </button>
              <button
                className="btn-primary px-4 py-1.5 text-sm"
                onClick={() => void handleSendToReview()}
                disabled={isSending}
              >
                {isSending ? "Передаю…" : "Передать в OCR-проверку →"}
              </button>
            </div>
          </div>
        )}

        {state !== "done" && (
          <div
            className="px-5 py-3 border-t text-right"
            style={{ borderColor: "var(--border-base)" }}
          >
            <button className="btn-ghost px-4 py-1.5 text-sm" onClick={onClose}>
              Закрыть
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
