"use client";

import { useState } from "react";
import { useWorkbench } from "@/components/workbench/context";
import type { PreviewVariant, RowDiagnostic } from "@/components/workbench/types";
import { formatValue } from "@/components/workbench/utils";

const PAGE_SIZE = 50;

type Props = {
  variants: PreviewVariant[];
  diagnostics: RowDiagnostic[];
};

function confidenceColor(conf: number): string {
  if (conf >= 0.9) return "badge-emerald";
  if (conf >= 0.7) return "badge-amber";
  return "badge-rose";
}

export function VariantPreviewPanel({ variants, diagnostics }: Props) {
  const {
    selectedVariantKey, setSelectedVariantKey,
    handleExport, handleExportCsv,
    isExporting, isExportingCsv,
  } = useWorkbench();

  const [page, setPage] = useState(0);

  const selectedVariant =
    variants.find((v) => v.key === selectedVariantKey) ?? variants[0] ?? null;

  const selectVariant = (key: string) => {
    setSelectedVariantKey(key);
    setPage(0);
  };

  if (!selectedVariant) return null;

  const diagMap = new Map(diagnostics.map((d) => [d.row_number, d]));
  const totalRows = selectedVariant.rows.length;
  const totalPages = Math.ceil(totalRows / PAGE_SIZE);
  const pageRows = selectedVariant.rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <section className="card p-4 sm:p-5 animate-fade-in">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            Предпросмотр
          </h2>
          <p className="mt-0.5 text-sm" style={{ color: "var(--text-secondary)" }}>
            {selectedVariant.description}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="btn-ghost"
            disabled={isExportingCsv}
            onClick={handleExportCsv}
            type="button"
          >
            {isExportingCsv ? "Экспорт…" : "CSV"}
          </button>
          <button
            className="btn-primary"
            disabled={isExporting}
            onClick={handleExport}
            type="button"
          >
            {isExporting ? "Экспорт…" : "Excel"}
          </button>
        </div>
      </div>

      {/* Variant tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {variants.map((v) => (
          <button
            key={v.key}
            className="rounded-full px-3 py-1.5 text-xs font-medium transition-all"
            style={{
              background: v.key === selectedVariant.key ? "var(--text-primary)" : "transparent",
              color: v.key === selectedVariant.key ? "var(--bg-base)" : "var(--text-secondary)",
              border: v.key === selectedVariant.key ? "none" : "1px solid var(--border-base)",
            }}
            onClick={() => selectVariant(v.key)}
            type="button"
          >
            {v.name}
            <span className="ml-1.5" style={{ opacity: 0.5 }}>{v.rows.length}</span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div
        className="overflow-hidden rounded-[var(--radius-inner)]"
        style={{ border: "1px solid var(--border-base)" }}
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead style={{ background: "var(--bg-hover)" }}>
              <tr>
                <th
                  className="px-3 py-2.5 text-xs font-medium text-left w-8"
                  style={{ color: "var(--text-muted)" }}
                >
                  #
                </th>
                {selectedVariant.columns.map((col) => (
                  <th
                    key={col.key}
                    className="px-3 py-2.5 text-xs font-medium text-left whitespace-nowrap"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {col.label}
                  </th>
                ))}
                <th
                  className="px-3 py-2.5 text-xs font-medium text-left w-12"
                  style={{ color: "var(--text-muted)" }}
                >
                  увер.
                </th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row, idx) => {
                const rowNum = page * PAGE_SIZE + idx + 1;
                const diag = diagMap.get(rowNum);
                const direction = row["direction"] as string | undefined;
                const rowClass =
                  direction === "inflow"
                    ? "row-inflow"
                    : direction === "outflow"
                    ? "row-outflow"
                    : "";

                return (
                  <tr
                    key={`${selectedVariant.key}-${rowNum}`}
                    className={`${rowClass} transition-colors`}
                    style={{ borderTop: "1px solid var(--border-subtle)" }}
                  >
                    <td className="px-3 py-2.5 text-xs" style={{ color: "var(--text-muted)" }}>
                      {rowNum}
                    </td>
                    {selectedVariant.columns.map((col) => (
                      <td
                        key={col.key}
                        className="px-3 py-2.5 whitespace-nowrap"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {formatValue(row[col.key] as string | number | null | undefined, col.kind)}
                      </td>
                    ))}
                    <td className="px-3 py-2.5">
                      {diag ? (
                        <span className={`badge text-[0.65rem] ${confidenceColor(diag.confidence)}`}>
                          {Math.round(diag.confidence * 100)}%
                        </span>
                      ) : (
                        <span className="badge badge-slate text-[0.65rem]">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Строки {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalRows)} из {totalRows}
          </p>
          <div className="flex gap-2">
            <button
              className="btn-ghost text-xs px-3 py-1.5"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              type="button"
            >
              ← Назад
            </button>
            <button
              className="btn-ghost text-xs px-3 py-1.5"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              type="button"
            >
              Вперёд →
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
