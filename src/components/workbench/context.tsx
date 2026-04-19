"use client";

import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type PropsWithChildren,
} from "react";

import type {
  OCRRuleVersionDiff,
  ParserDescriptor,
  PreviewResponse,
  SessionSummary,
} from "@/components/workbench/types";

export type Toast = {
  id: string;
  kind: "info" | "success" | "error";
  message: string;
};

export type WorkbenchCtx = {
  preview: PreviewResponse | null;
  deferredPreview: PreviewResponse | null;
  allVariants: PreviewResponse["variants"];
  history: SessionSummary[];
  parsers: ParserDescriptor[];
  selectedVariantKey: string | null;
  setSelectedVariantKey: (k: string) => void;
  selectedDiagnosticRow: number | null;
  setSelectedDiagnosticRow: (n: number | null) => void;
  rowEditorDate: string;
  setRowEditorDate: (v: string) => void;
  rowEditorAmount: string;
  setRowEditorAmount: (v: string) => void;
  rowEditorOperation: string;
  setRowEditorOperation: (v: string) => void;
  rowEditorDetail: string;
  setRowEditorDetail: (v: string) => void;
  rowEditorDirection: "inflow" | "outflow";
  setRowEditorDirection: (v: "inflow" | "outflow") => void;
  rowEditorNote: string;
  setRowEditorNote: (v: string) => void;
  selectedReviewTableIndex: number;
  setSelectedReviewTableIndex: (i: number) => void;
  selectedReviewHeaderRow: number;
  setSelectedReviewHeaderRow: (i: number) => void;
  reviewTitle: string;
  setReviewTitle: (v: string) => void;
  saveReviewTemplate: boolean;
  setSaveReviewTemplate: (v: boolean) => void;
  reviewTemplateName: string;
  setReviewTemplateName: (v: string) => void;
  reviewColumnMapping: Record<string, string>;
  setReviewColumnMappingField: (field: string, value: string) => void;
  excludedExportRows: number[];
  setExcludedExportRows: (rows: number[]) => void;
  customExportColumns: Array<{key: string; label: string; kind: string}> | null;
  setCustomExportColumns: (cols: Array<{key: string; label: string; kind: string}> | null) => void;
  customExportRows: Array<Record<string, unknown>> | null;
  setCustomExportRows: (rows: Array<Record<string, unknown>> | null) => void;
  isPending: boolean;
  isSavingRowCorrection: boolean;
  isMaterializingReview: boolean;
  isExporting: boolean;
  isExportingCsv: boolean;
  isLoadingSession: boolean;
  error: string | null;
  toasts: Toast[];
  dismissToast: (id: string) => void;
  handlePreviewNow: (file: File) => void;
  handleExport: () => void;
  handleExportCsv: () => void;
  handleSaveRowCorrection: () => void;
  handleMaterializeReview: () => void;
  handleCompareRule: (_templateId: string) => Promise<OCRRuleVersionDiff | null>;
  handleCreateTemplate: (name: string, parserKey: string, variantKey: string, columns: Array<{key: string; label: string; kind: string}>) => Promise<string | null>;
  loadSession: (sessionId: string) => void;
};

const Ctx = createContext<WorkbenchCtx | null>(null);

export function useWorkbench(): WorkbenchCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWorkbench must be used inside WorkbenchProvider");
  return ctx;
}

async function readErrorMessage(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      const payload = (await response.json()) as { detail?: string; message?: string; error?: string };
      return payload.detail ?? payload.message ?? payload.error ?? `HTTP ${response.status}`;
    } catch {
      return `HTTP ${response.status}`;
    }
  }

  try {
    const text = await response.text();
    return text || `HTTP ${response.status}`;
  } catch {
    return `HTTP ${response.status}`;
  }
}

async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  return (await response.json()) as T;
}

function ensureArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

type WorkbenchProviderProps = PropsWithChildren<{
  apiBaseUrl: string;
}>;

export function WorkbenchProvider({ children, apiBaseUrl }: WorkbenchProviderProps) {
  const api = apiBaseUrl.replace(/\/$/, "");

  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [history, setHistory] = useState<SessionSummary[]>([]);
  const [parsers, setParsers] = useState<ParserDescriptor[]>([]);
  const [selectedVariantKey, setSelectedVariantKey] = useState<string | null>(null);
  const [selectedDiagnosticRow, setSelectedDiagnosticRow] = useState<number | null>(null);
  const [rowEditorDate, setRowEditorDate] = useState("");
  const [rowEditorAmount, setRowEditorAmount] = useState("");
  const [rowEditorOperation, setRowEditorOperation] = useState("");
  const [rowEditorDetail, setRowEditorDetail] = useState("");
  const [rowEditorDirection, setRowEditorDirection] = useState<"inflow" | "outflow">("outflow");
  const [rowEditorNote, setRowEditorNote] = useState("");
  const [selectedReviewTableIndex, setSelectedReviewTableIndex] = useState(0);
  const [selectedReviewHeaderRow, setSelectedReviewHeaderRow] = useState(0);
  const [reviewTitle, setReviewTitle] = useState("");
  const [saveReviewTemplate, setSaveReviewTemplate] = useState(true);
  const [reviewTemplateName, setReviewTemplateName] = useState("");
  const [reviewColumnMapping, setReviewColumnMapping] = useState<Record<string, string>>({});
  const [isPending, startUpload] = useTransition();
  const [isSavingRowCorrection, setIsSavingRowCorrection] = useState(false);
  const [isMaterializingReview, setIsMaterializingReview] = useState(false);
  const [excludedExportRows, setExcludedExportRows] = useState<number[]>([]);
  const [customExportColumns, setCustomExportColumns] = useState<Array<{key: string; label: string; kind: string}> | null>(null);
  const [customExportRows, setCustomExportRows] = useState<Array<Record<string, unknown>> | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const deferredPreview = useDeferredValue(preview);
  const allVariants = useMemo(
    () => [...(deferredPreview?.saved_variants ?? []), ...(deferredPreview?.variants ?? [])],
    [deferredPreview],
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const payload = await fetchJson<unknown>(`${api}/api/v1/transforms/history`);
      setHistory(ensureArray<SessionSummary>(payload));
    } catch {
      setHistory([]);
    }
  }, [api]);

  const loadParsers = useCallback(async () => {
    try {
      const payload = await fetchJson<unknown>(`${api}/api/v1/transforms/parsers`);
      setParsers(ensureArray<ParserDescriptor>(payload));
    } catch {
      setParsers([]);
    }
  }, [api]);

  useEffect(() => {
    startTransition(() => {
      void Promise.all([loadHistory(), loadParsers()]);
    });
  }, [loadHistory, loadParsers]);

  useEffect(() => {
    if (!deferredPreview) return;
    const parserKey = deferredPreview.document.parser_key;
    let next =
      deferredPreview.default_variant_key ??
      deferredPreview.preference?.preferred_variant_key ??
      allVariants[0]?.key ??
      null;
    try {
      const savedTemplateId = localStorage.getItem(`template_id_${parserKey}`);
      if (savedTemplateId) {
        const templateKey = `template::${savedTemplateId}`;
        if (allVariants.some((v) => v.key === templateKey)) {
          next = templateKey;
        }
      }
    } catch {
      // ignore localStorage errors
    }
    setSelectedVariantKey(next);
  }, [allVariants, deferredPreview]);

  useEffect(() => {
    if (!selectedDiagnosticRow || !deferredPreview) return;
    const row = deferredPreview.row_diagnostics.find((item) => item.row_number === selectedDiagnosticRow);
    if (!row) return;
    setRowEditorDate(row.date);
    setRowEditorAmount(String(Math.abs(row.amount)));
    setRowEditorOperation(row.operation);
    setRowEditorDetail(row.detail);
    setRowEditorDirection(row.amount >= 0 ? "inflow" : "outflow");
    setRowEditorNote("");
  }, [selectedDiagnosticRow, deferredPreview]);

  useEffect(() => {
    const review = deferredPreview?.ocr_review;
    if (!review) return;
    setSelectedReviewTableIndex(review.suggested_table_index ?? review.tables[0]?.table_index ?? 0);
    setSelectedReviewHeaderRow(review.suggested_header_row_index ?? 0);
    setReviewTitle(review.source_filename);
    setReviewTemplateName(review.source_filename.replace(/\.[^.]+$/, ""));
    setReviewColumnMapping(
      Object.fromEntries(review.available_fields.map((field) => [field.key, ""])),
    );
  }, [deferredPreview?.ocr_review]);

  const loadSession = useCallback(
    async (sessionId: string) => {
      setIsLoadingSession(true);
      setError(null);
      try {
        setPreview(await fetchJson<PreviewResponse>(`${api}/api/v1/transforms/sessions/${sessionId}`));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ошибка загрузки сессии.");
      } finally {
        setIsLoadingSession(false);
      }
    },
    [api],
  );

  const handlePreviewNow = useCallback(
    (file: File) => {
      setError(null);
      startUpload(async () => {
        try {
          const fd = new FormData();
          fd.append("file", file);
          setPreview(await fetchJson<PreviewResponse>(`${api}/api/v1/transforms/preview`, { method: "POST", body: fd }));
          await loadHistory();
        } catch (e) {
          setError(e instanceof Error ? e.message : "Ошибка обработки.");
        }
      });
    },
    [api, loadHistory],
  );

  const handleExport = useCallback(async () => {
    if (!preview || !selectedVariantKey) return;
    setIsExporting(true);
    setError(null);
    try {
      const res = await fetch(`${api}/api/v1/transforms/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: preview.session_id,
          variant_key: selectedVariantKey,
          excluded_rows: excludedExportRows,
          custom_columns: customExportColumns ?? undefined,
          custom_rows: customExportRows ?? undefined,
        }),
      });
      if (!res.ok) throw new Error(await readErrorMessage(res));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${selectedVariantKey}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка экспорта.");
    } finally {
      setIsExporting(false);
    }
  }, [api, preview, selectedVariantKey]);

  const handleExportCsv = useCallback(async () => {
    if (!preview || !selectedVariantKey) return;
    setIsExportingCsv(true);
    setError(null);
    try {
      const res = await fetch(`${api}/api/v1/transforms/export/csv`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: preview.session_id, variant_key: selectedVariantKey }),
      });
      if (!res.ok) throw new Error(await readErrorMessage(res));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${selectedVariantKey}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка экспорта CSV.");
    } finally {
      setIsExportingCsv(false);
    }
  }, [api, preview, selectedVariantKey]);

  const handleSaveRowCorrection = useCallback(async () => {
    if (!preview || !selectedDiagnosticRow) return;
    setIsSavingRowCorrection(true);
    setError(null);
    try {
      const res = await fetch(
        `${api}/api/v1/transforms/sessions/${preview.session_id}/rows/${selectedDiagnosticRow}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: rowEditorDate,
            amount: Number(rowEditorAmount),
            operation: rowEditorOperation,
            detail: rowEditorDetail,
            direction: rowEditorDirection,
            note: rowEditorNote || null,
          }),
        },
      );
      if (!res.ok) throw new Error(await readErrorMessage(res));
      setPreview((await res.json()) as PreviewResponse);
      setSelectedDiagnosticRow(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сохранения исправления.");
    } finally {
      setIsSavingRowCorrection(false);
    }
  }, [api, preview, selectedDiagnosticRow, rowEditorDate, rowEditorAmount, rowEditorOperation, rowEditorDetail, rowEditorDirection, rowEditorNote]);

  const handleMaterializeReview = useCallback(async () => {
    const review = preview?.ocr_review;
    if (!review) return;
    setIsMaterializingReview(true);
    setError(null);
    try {
      const res = await fetch(`${api}/api/v1/transforms/ocr-reviews/${review.review_id}/materialize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table_index: selectedReviewTableIndex,
          header_row_index: selectedReviewHeaderRow,
          title: reviewTitle,
          save_mapping_template: saveReviewTemplate,
          mapping_template_name: reviewTemplateName,
          column_mapping: Object.fromEntries(
            Object.entries(reviewColumnMapping).map(([key, value]) => [key, value === "" ? null : Number(value)]),
          ),
        }),
      });
      if (!res.ok) throw new Error(await readErrorMessage(res));
      setPreview((await res.json()) as PreviewResponse);
      await loadHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка применения OCR проверки.");
    } finally {
      setIsMaterializingReview(false);
    }
  }, [api, preview, selectedReviewTableIndex, selectedReviewHeaderRow, reviewTitle, saveReviewTemplate, reviewTemplateName, reviewColumnMapping, loadHistory]);

  const handleCompareRule = useCallback(async (): Promise<OCRRuleVersionDiff | null> => null, []);

  const handleCreateTemplate = useCallback(async (
    name: string,
    parserKey: string,
    variantKey: string,
    columns: Array<{key: string; label: string; kind: string}>,
  ): Promise<string | null> => {
    try {
      const res = await fetch(`${api}/api/v1/transforms/templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parser_key: parserKey,
          name,
          description: "",
          base_variant_key: variantKey,
          columns: columns.map((c) => ({ key: c.key, label: c.label, kind: c.kind, enabled: true })),
          is_default: true,
        }),
      });
      if (!res.ok) throw new Error(await readErrorMessage(res));
      const data = (await res.json()) as { template_id: string };
      return data.template_id;
    } catch {
      return null;
    }
  }, [api]);

  const setReviewColumnMappingField = useCallback((field: string, value: string) => {
    setReviewColumnMapping((prev) => ({ ...prev, [field]: value }));
  }, []);

  const ctx: WorkbenchCtx = {
    preview,
    deferredPreview,
    allVariants,
    history,
    parsers,
    selectedVariantKey,
    setSelectedVariantKey,
    selectedDiagnosticRow,
    setSelectedDiagnosticRow,
    rowEditorDate,
    setRowEditorDate,
    rowEditorAmount,
    setRowEditorAmount,
    rowEditorOperation,
    setRowEditorOperation,
    rowEditorDetail,
    setRowEditorDetail,
    rowEditorDirection,
    setRowEditorDirection,
    rowEditorNote,
    setRowEditorNote,
    selectedReviewTableIndex,
    setSelectedReviewTableIndex,
    selectedReviewHeaderRow,
    setSelectedReviewHeaderRow,
    reviewTitle,
    setReviewTitle,
    saveReviewTemplate,
    setSaveReviewTemplate,
    reviewTemplateName,
    setReviewTemplateName,
    reviewColumnMapping,
    setReviewColumnMappingField,
    excludedExportRows,
    setExcludedExportRows,
    customExportColumns,
    setCustomExportColumns,
    customExportRows,
    setCustomExportRows,
    isPending,
    isSavingRowCorrection,
    isMaterializingReview,
    isExporting,
    isExportingCsv,
    isLoadingSession,
    error,
    toasts,
    dismissToast,
    handlePreviewNow,
    handleExport,
    handleExportCsv,
    handleSaveRowCorrection,
    handleMaterializeReview,
    handleCompareRule,
    handleCreateTemplate,
    loadSession,
  };

  return <Ctx.Provider value={ctx}>{children}</Ctx.Provider>;
}
