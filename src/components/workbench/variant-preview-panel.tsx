"use client";

import { useMemo, useState } from "react";

import { useWorkbench } from "@/components/workbench/context";
import type { PreviewVariant, RowDiagnostic } from "@/components/workbench/types";
import { formatValue } from "@/components/workbench/utils";

const PAGE_SIZE = 50;
const PRIMARY_GROUP = "primary";

type Props = {
  variants: PreviewVariant[];
  diagnostics: RowDiagnostic[];
};

function confidenceColor(confidence: number): string {
  if (confidence >= 0.9) return "badge-emerald";
  if (confidence >= 0.7) return "badge-amber";
  return "badge-rose";
}

function variantGroupKey(variant: PreviewVariant): string {
  return variant.group ?? PRIMARY_GROUP;
}

function isWideTextColumn(columnKey: string, kind: string): boolean {
  if (kind === "currency") return false;
  return ["detail", "comment", "details_operation"].includes(columnKey);
}

export function VariantPreviewPanel({ variants, diagnostics }: Props) {
  const {
    selectedVariantKey,
    setSelectedVariantKey,
    handleExport,
    handleExportCsv,
    isExporting,
    isExportingCsv,
  } = useWorkbench();

  const [page, setPage] = useState(0);

  const groupedVariants = useMemo(() => {
    const order: string[] = [];
    const groups = new Map<string, PreviewVariant[]>();
    for (const variant of variants) {
      const groupKey = variantGroupKey(variant);
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
        order.push(groupKey);
      }
      groups.get(groupKey)?.push(variant);
    }
    return { groups, order };
  }, [variants]);

  const selectedVariant =
    variants.find((variant) => variant.key === selectedVariantKey) ?? variants[0] ?? null;

  if (!selectedVariant) return null;

  const activeGroup = variantGroupKey(selectedVariant);
  const pageVariants = groupedVariants.groups.get(activeGroup) ?? [selectedVariant];
  const alternateGroup =
    activeGroup === PRIMARY_GROUP
      ? groupedVariants.order.find((groupKey) => groupKey !== PRIMARY_GROUP) ?? null
      : PRIMARY_GROUP;
  const showVariantSwitcher = groupedVariants.order.length > 1 && alternateGroup !== null;

  const selectVariant = (key: string) => {
    setSelectedVariantKey(key);
    setPage(0);
  };

  const swapVariantGroup = () => {
    if (!alternateGroup) return;
    const targetVariants = groupedVariants.groups.get(alternateGroup);
    const nextVariant =
      targetVariants?.find((variant) => !variant.template_id) ??
      targetVariants?.[0];
    if (!nextVariant) return;
    setSelectedVariantKey(nextVariant.key);
    setPage(0);
  };

  const diagnosticsMap = new Map(diagnostics.map((item) => [item.row_number, item]));
  const totalRows = selectedVariant.rows.length;
  const totalPages = Math.ceil(totalRows / PAGE_SIZE);
  const pageRows = selectedVariant.rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <section className="card p-4 sm:p-5 animate-fade-in">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            {"\u041f\u0440\u0435\u0434\u043f\u0440\u043e\u0441\u043c\u043e\u0442\u0440"}
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
            {isExportingCsv ? "\u042d\u043a\u0441\u043f\u043e\u0440\u0442..." : "CSV"}
          </button>
          <button
            className="btn-primary"
            disabled={isExporting}
            onClick={handleExport}
            type="button"
          >
            {isExporting ? "\u042d\u043a\u0441\u043f\u043e\u0440\u0442..." : "Excel"}
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start">
        {showVariantSwitcher && (
          <button
            className={`variant-group-toggle ${activeGroup === PRIMARY_GROUP ? "variant-group-toggle-pulse" : "variant-group-toggle-return"}`}
            onClick={swapVariantGroup}
            type="button"
          >
            <span className="variant-group-toggle__pulse" aria-hidden="true" />
            <span className="variant-group-toggle__label">
              {activeGroup === PRIMARY_GROUP
                ? "\u0414\u043e\u0441\u0442\u0443\u043f\u043d\u044b \u0434\u0440\u0443\u0433\u0438\u0435 \u0432\u0430\u0440\u0438\u0430\u043d\u0442\u044b"
                : "\u0412\u0435\u0440\u043d\u0443\u0442\u044c\u0441\u044f \u043a \u0441\u0442\u0430\u043d\u0434\u0430\u0440\u0442\u043d\u044b\u043c \u0432\u0438\u0434\u0430\u043c"}
            </span>
          </button>
        )}

        <div key={`variant-group-${activeGroup}`} className="flex flex-wrap gap-2 animate-variant-swap">
          {pageVariants.map((variant) => (
            <button
              key={variant.key}
              className="rounded-full px-3 py-1.5 text-xs font-medium transition-all"
              style={{
                background:
                  variant.key === selectedVariant.key ? "var(--text-primary)" : "transparent",
                color: variant.key === selectedVariant.key ? "var(--bg-base)" : "var(--text-secondary)",
                border:
                  variant.key === selectedVariant.key
                    ? "none"
                    : "1px solid var(--border-base)",
              }}
              onClick={() => selectVariant(variant.key)}
              type="button"
            >
              {variant.name}
              <span className="ml-1.5" style={{ opacity: 0.5 }}>
                {variant.rows.length}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div
        key={`variant-table-${activeGroup}-${selectedVariant.key}`}
        className="overflow-hidden rounded-[var(--radius-inner)] animate-variant-swap"
        style={{ border: "1px solid var(--border-base)" }}
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead style={{ background: "var(--bg-hover)" }}>
              <tr>
                <th
                  className="w-8 px-3 py-2.5 text-left text-xs font-medium"
                  style={{ color: "var(--text-muted)" }}
                >
                  #
                </th>
                {selectedVariant.columns.map((column) => (
                  <th
                    key={column.key}
                    className={`px-3 py-2.5 text-left text-xs font-medium ${isWideTextColumn(column.key, column.kind) ? "min-w-[15rem] whitespace-normal" : "whitespace-nowrap"}`}
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {column.label}
                  </th>
                ))}
                <th
                  className="w-12 px-3 py-2.5 text-left text-xs font-medium"
                  style={{ color: "var(--text-muted)" }}
                >
                  {"\u0423\u0432\u0435\u0440."}
                </th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row, index) => {
                const rowNumber = page * PAGE_SIZE + index + 1;
                const diagnostic = diagnosticsMap.get(rowNumber);
                const direction = row.direction as string | undefined;
                const rowClass =
                  direction === "inflow"
                    ? "row-inflow"
                    : direction === "outflow"
                      ? "row-outflow"
                      : "";

                return (
                  <tr
                    key={`${selectedVariant.key}-${rowNumber}`}
                    className={`${rowClass} transition-colors`}
                    style={{ borderTop: "1px solid var(--border-subtle)" }}
                  >
                    <td className="px-3 py-2.5 text-xs" style={{ color: "var(--text-muted)" }}>
                      {rowNumber}
                    </td>
                    {selectedVariant.columns.map((column) => (
                      <td
                        key={column.key}
                        className={`px-3 py-2.5 ${isWideTextColumn(column.key, column.kind) ? "min-w-[15rem] whitespace-normal break-words align-top" : "whitespace-nowrap"}`}
                        style={{ color: "var(--text-primary)" }}
                      >
                        {formatValue(
                          row[column.key] as string | number | null | undefined,
                          column.kind,
                        )}
                      </td>
                    ))}
                    <td className="px-3 py-2.5">
                      {diagnostic ? (
                        <span className={`badge text-[0.65rem] ${confidenceColor(diagnostic.confidence)}`}>
                          {Math.round(diagnostic.confidence * 100)}%
                        </span>
                      ) : (
                        <span className="badge badge-slate text-[0.65rem]">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {"\u0421\u0442\u0440\u043e\u043a\u0438"} {page * PAGE_SIZE + 1}-
            {Math.min((page + 1) * PAGE_SIZE, totalRows)} {"\u0438\u0437"} {totalRows}
          </p>
          <div className="flex gap-2">
            <button
              className="btn-ghost px-3 py-1.5 text-xs"
              disabled={page === 0}
              onClick={() => setPage((current) => current - 1)}
              type="button"
            >
              {"<- \u041d\u0430\u0437\u0430\u0434"}
            </button>
            <button
              className="btn-ghost px-3 py-1.5 text-xs"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((current) => current + 1)}
              type="button"
            >
              {"\u0412\u043f\u0435\u0440\u0451\u0434 ->"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
