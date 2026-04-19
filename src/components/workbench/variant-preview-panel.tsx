"use client";

import { useMemo, useRef, useState } from "react";

import { useWorkbench } from "@/components/workbench/context";
import { SaveTemplateModal } from "@/components/workbench/save-template-modal";
import type { PreviewColumn, PreviewVariant, RowDiagnostic } from "@/components/workbench/types";
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
    isExporting,
    setExcludedExportRows,
    deferredPreview,
  } = useWorkbench();

  const [page, setPage] = useState(0);

  // --- edit mode state ---
  const [editMode, setEditMode] = useState(false);
  const [editColumns, setEditColumnsRaw] = useState<PreviewColumn[]>([]);
  const [hiddenRows, setHiddenRows] = useState<Set<number>>(new Set());
  const [isDirty, setIsDirty] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [editingColIdx, setEditingColIdx] = useState<number | null>(null);
  const [colLabelDraft, setColLabelDraft] = useState("");
  const colLabelRef = useRef<HTMLInputElement>(null);

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
    exitEditMode(false);
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
    exitEditMode(false);
  };

  // ---- edit mode helpers ----

  const enterEditMode = () => {
    setEditColumnsRaw(selectedVariant.columns.map((c) => ({ ...c })));
    setHiddenRows(new Set());
    setIsDirty(false);
    setEditMode(true);
  };

  const exitEditMode = (confirm = true) => {
    if (confirm && isDirty && !window.confirm("Выйти из режима редактирования? Несохранённые изменения будут потеряны.")) return;
    setEditMode(false);
    setIsDirty(false);
    setHiddenRows(new Set());
    setExcludedExportRows([]);
  };

  const setEditColumns = (cols: PreviewColumn[]) => {
    setEditColumnsRaw(cols);
    setIsDirty(true);
  };

  const renameColumn = (idx: number, label: string) => {
    const next = editColumns.map((c, i) => (i === idx ? { ...c, label } : c));
    setEditColumns(next);
  };

  const moveColumn = (idx: number, dir: -1 | 1) => {
    const next = [...editColumns];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setEditColumns(next);
  };

  const deleteColumn = (idx: number) => {
    setEditColumns(editColumns.filter((_, i) => i !== idx));
  };

  const addColumn = () => {
    setEditColumns([
      ...editColumns,
      { key: `custom_${Date.now()}`, label: "Новый столбец", kind: "text" },
    ]);
  };

  const deleteRow = (rowNumber: number) => {
    const next = new Set(hiddenRows);
    next.add(rowNumber);
    setHiddenRows(next);
    setIsDirty(true);
  };

  const restoreRow = (rowNumber: number) => {
    const next = new Set(hiddenRows);
    next.delete(rowNumber);
    setHiddenRows(next);
    setIsDirty(true);
  };

  const resetToDefault = () => {
    if (!window.confirm("Сбросить все изменения и вернуться к стандартному формату? Сохранённый шаблон для этого банка также будет удалён.")) return;
    const parserKey = deferredPreview?.document.parser_key;
    if (parserKey) {
      try { localStorage.removeItem(`template_id_${parserKey}`); } catch { /* ignore */ }
    }
    setEditColumnsRaw(selectedVariant.columns.map((c) => ({ ...c })));
    setHiddenRows(new Set());
    setIsDirty(false);
    setExcludedExportRows([]);
  };

  const handleExportWithEdits = () => {
    if (editMode) {
      setExcludedExportRows([...hiddenRows]);
    }
    void handleExport();
  };

  const startColRename = (idx: number, currentLabel: string) => {
    setEditingColIdx(idx);
    setColLabelDraft(currentLabel);
    setTimeout(() => colLabelRef.current?.select(), 0);
  };

  const commitColRename = () => {
    if (editingColIdx !== null && colLabelDraft.trim()) {
      renameColumn(editingColIdx, colLabelDraft.trim());
    }
    setEditingColIdx(null);
  };

  // ---- render data ----
  const displayColumns = editMode ? editColumns : selectedVariant.columns;
  const diagnosticsMap = new Map(diagnostics.map((item) => [item.row_number, item]));
  const totalRows = selectedVariant.rows.length;

  // in edit mode, filter hidden rows before paging
  const visibleRows = editMode
    ? selectedVariant.rows.filter((_, i) => !hiddenRows.has(i + 1))
    : selectedVariant.rows;
  const totalPages = Math.ceil(visibleRows.length / PAGE_SIZE);
  const pageRows = visibleRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <section className="card p-4 sm:p-5 animate-fade-in">
      {/* header */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            {"Предпросмотр"}
          </h2>
          <p className="mt-0.5 text-sm" style={{ color: "var(--text-secondary)" }}>
            {selectedVariant.description}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {!editMode && (
            <button
              className="btn-ghost px-3 py-1.5 text-xs"
              onClick={enterEditMode}
              type="button"
            >
              {"Редактировать"}
            </button>
          )}
          {editMode && (
            <button
              className="btn-ghost px-3 py-1.5 text-xs"
              onClick={() => exitEditMode(true)}
              type="button"
            >
              {"Выйти"}
            </button>
          )}
          <button
            className="btn-primary"
            disabled={isExporting}
            onClick={handleExportWithEdits}
            type="button"
          >
            {isExporting ? "Экспорт..." : "Excel"}
          </button>
        </div>
      </div>

      {/* variant group switcher */}
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
                ? "Доступны другие варианты"
                : "Вернуться к стандартным видам"}
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

      {/* edit mode info bar */}
      {editMode && (
        <div
          className="mb-3 flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-xs"
          style={{ background: "var(--bg-hover)", border: "1px solid var(--border-base)", color: "var(--text-secondary)" }}
        >
          <span>{"Режим редактирования — переименовывайте, перемещайте и удаляйте столбцы и строки"}</span>
          {hiddenRows.size > 0 && (
            <span className="badge badge-amber">{hiddenRows.size} {hiddenRows.size === 1 ? "строка скрыта" : "строк скрыто"}</span>
          )}
        </div>
      )}

      {/* table */}
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
                {displayColumns.map((column, colIdx) => (
                  <th
                    key={column.key}
                    className={`px-2 py-2 text-left text-xs font-medium ${isWideTextColumn(column.key, column.kind) ? "min-w-[15rem] whitespace-normal" : "whitespace-nowrap"}`}
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {editMode ? (
                      <div className="flex items-center gap-1">
                        {editingColIdx === colIdx ? (
                          <input
                            ref={colLabelRef}
                            aria-label="Название столбца"
                            className="rounded px-1 py-0.5 text-xs w-28"
                            style={{
                              background: "var(--surface)",
                              border: "1px solid var(--accent-blue, #3b82f6)",
                              color: "var(--text-primary)",
                              outline: "none",
                            }}
                            value={colLabelDraft}
                            onChange={(e) => setColLabelDraft(e.target.value)}
                            onBlur={commitColRename}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitColRename();
                              if (e.key === "Escape") setEditingColIdx(null);
                            }}
                          />
                        ) : (
                          <button
                            className="text-left hover:underline"
                            style={{ color: "var(--text-primary)" }}
                            onClick={() => startColRename(colIdx, column.label)}
                            title="Нажмите для переименования"
                            type="button"
                          >
                            {column.label}
                          </button>
                        )}
                        <div className="flex items-center gap-0.5 ml-1 opacity-60 hover:opacity-100">
                          <button
                            type="button"
                            title="Переместить влево"
                            disabled={colIdx === 0}
                            className="text-[10px] px-0.5 hover:text-blue-500 disabled:opacity-20"
                            onClick={() => moveColumn(colIdx, -1)}
                          >←</button>
                          <button
                            type="button"
                            title="Переместить вправо"
                            disabled={colIdx === displayColumns.length - 1}
                            className="text-[10px] px-0.5 hover:text-blue-500 disabled:opacity-20"
                            onClick={() => moveColumn(colIdx, 1)}
                          >→</button>
                          <button
                            type="button"
                            title="Удалить столбец"
                            className="text-[10px] px-0.5 hover:text-rose-500"
                            onClick={() => deleteColumn(colIdx)}
                          >✕</button>
                        </div>
                      </div>
                    ) : (
                      column.label
                    )}
                  </th>
                ))}
                {editMode && (
                  <th className="px-2 py-2">
                    <button
                      type="button"
                      title="Добавить столбец"
                      className="text-xs px-1.5 py-0.5 rounded"
                      style={{ background: "var(--bg-hover)", border: "1px dashed var(--border-base)", color: "var(--text-muted)" }}
                      onClick={addColumn}
                    >+</button>
                  </th>
                )}
                {!editMode && (
                  <th
                    className="w-12 px-3 py-2.5 text-left text-xs font-medium"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {"Увер."}
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row, index) => {
                const originalIndex = editMode
                  ? selectedVariant.rows.indexOf(row)
                  : index;
                const rowNumber = editMode ? originalIndex + 1 : page * PAGE_SIZE + index + 1;
                const displayNumber = page * PAGE_SIZE + index + 1;
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
                      {displayNumber}
                    </td>
                    {displayColumns.map((column) => (
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
                    {editMode && (
                      <td className="px-2 py-2.5">
                        <button
                          type="button"
                          title="Скрыть строку"
                          className="text-xs opacity-40 hover:opacity-100 hover:text-rose-500"
                          onClick={() => deleteRow(rowNumber)}
                        >✕</button>
                      </td>
                    )}
                    {!editMode && (
                      <td className="px-3 py-2.5">
                        {diagnostic ? (
                          <span className={`badge text-[0.65rem] ${confidenceColor(diagnostic.confidence)}`}>
                            {Math.round(diagnostic.confidence * 100)}%
                          </span>
                        ) : (
                          <span className="badge badge-slate text-[0.65rem]">-</span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* pagination */}
      {totalPages > 1 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {"Строки"} {page * PAGE_SIZE + 1}-
            {Math.min((page + 1) * PAGE_SIZE, visibleRows.length)} {"из"} {visibleRows.length}
            {editMode && hiddenRows.size > 0 && (
              <span className="ml-1" style={{ color: "var(--text-muted)" }}>
                {"(скрыто "}{hiddenRows.size}{")"}{" "}
                <button
                  type="button"
                  className="underline text-xs"
                  onClick={() => { setHiddenRows(new Set()); setIsDirty(true); }}
                >
                  восстановить все
                </button>
              </span>
            )}
          </p>
          <div className="flex gap-2">
            <button
              className="btn-ghost px-3 py-1.5 text-xs"
              disabled={page === 0}
              onClick={() => setPage((current) => current - 1)}
              type="button"
            >
              {"<- Назад"}
            </button>
            <button
              className="btn-ghost px-3 py-1.5 text-xs"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((current) => current + 1)}
              type="button"
            >
              {"Вперёд ->"}
            </button>
          </div>
        </div>
      )}

      {/* dirty bar */}
      {editMode && isDirty && (
        <div
          className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-3"
          style={{ background: "var(--bg-hover)", border: "1px solid var(--border-base)" }}
        >
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {"Есть несохранённые изменения"}
          </p>
          <div className="flex gap-2">
            <button
              className="btn-ghost px-3 py-1.5 text-xs"
              onClick={resetToDefault}
              type="button"
            >
              {"Сбросить к стандарту"}
            </button>
            <button
              className="btn-primary px-3 py-1.5 text-xs"
              onClick={() => {
                setExcludedExportRows([...hiddenRows]);
                setShowSaveModal(true);
              }}
              type="button"
            >
              {"Сохранить шаблон"}
            </button>
          </div>
        </div>
      )}

      {/* total rows info for non-paginated */}
      {totalPages <= 1 && editMode && hiddenRows.size > 0 && (
        <div className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
          {"Скрыто строк: "}{hiddenRows.size}{" "}
          <button
            type="button"
            className="underline"
            onClick={() => { setHiddenRows(new Set()); setIsDirty(editColumns !== selectedVariant.columns); }}
          >
            восстановить все
          </button>
        </div>
      )}

      {/* save modal */}
      {showSaveModal && (
        <SaveTemplateModal
          parserKey={deferredPreview?.document.parser_key ?? "unknown"}
          variantKey={selectedVariant.key}
          columns={editColumns}
          onClose={() => setShowSaveModal(false)}
          onSaved={(templateId) => {
            setShowSaveModal(false);
            setIsDirty(false);
            setEditMode(false);
            setExcludedExportRows([...hiddenRows]);
            // auto-select the new template variant if it appears in allVariants
            setSelectedVariantKey(`template::${templateId}`);
          }}
        />
      )}
    </section>
  );
}
