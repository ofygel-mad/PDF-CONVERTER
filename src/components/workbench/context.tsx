"use client";

import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type PropsWithChildren,
} from "react";

import type {
  CorrectionMemoryEntry,
  JobSummary,
  OCRRuleManagerSnapshot,
  OCRRuleVersionDiff,
  OnboardingProject,
  ParserDescriptor,
  PreviewResponse,
  SessionSummary,
  TemplateColumnConfig,
  VisionStatus,
} from "@/components/workbench/types";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/* ─── Toast types ─────────────────────────────────────────────── */
export type Toast = {
  id: string;
  kind: "info" | "success" | "error";
  message: string;
};

/* ─── Context shape ───────────────────────────────────────────── */
export type WorkbenchCtx = {
  /* ── data ── */
  preview: PreviewResponse | null;
  deferredPreview: PreviewResponse | null;
  allVariants: PreviewResponse["variants"];
  history: SessionSummary[];
  parsers: ParserDescriptor[];
  visionStatus: VisionStatus | null;
  ruleManager: OCRRuleManagerSnapshot | null;
  correctionMemory: CorrectionMemoryEntry[];
  jobs: JobSummary[];
  projects: OnboardingProject[];

  /* ── selection state ── */
  selectedVariantKey: string | null;
  setSelectedVariantKey: (k: string) => void;
  selectedDiagnosticRow: number | null;
  setSelectedDiagnosticRow: (n: number | null) => void;

  /* ── row editor state ── */
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

  /* ── OCR review state ── */
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

  /* ── template editor state ── */
  templateName: string;
  setTemplateName: (v: string) => void;
  templateDescription: string;
  setTemplateDescription: (v: string) => void;
  templateIsDefault: boolean;
  setTemplateIsDefault: (v: boolean) => void;

  /* ── loading flags ── */
  isPending: boolean;
  isSavingRowCorrection: boolean;
  isMaterializingReview: boolean;
  isExporting: boolean;
  isExportingCsv: boolean;
  isLoadingSession: boolean;
  isCreatingTemplate: boolean;

  /* ── errors / toasts ── */
  error: string | null;
  toasts: Toast[];
  dismissToast: (id: string) => void;

  /* ── actions ── */
  handlePreviewNow: (file: File) => void;
  handleQueueJob: (file: File) => void;
  handleExport: () => void;
  handleExportCsv: () => void;
  handleSaveRowCorrection: () => void;
  handleMaterializeReview: () => void;
  handleCreateTemplate: () => void;
  handleToggleRule: (templateId: string, isActive: boolean) => void;
  handleRollbackRule: (templateId: string) => void;
  handleCompareRule: (templateId: string) => Promise<OCRRuleVersionDiff | null>;
  handleCreateProject: (name: string, bankName: string, notes: string) => void;
  handleAttachCurrentResult: (projectId: string) => void;
  loadSession: (sessionId: string) => void;
};

const Ctx = createContext<WorkbenchCtx | null>(null);

export function useWorkbench(): WorkbenchCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWorkbench must be used inside WorkbenchProvider");
  return ctx;
}

/* ─── Provider ────────────────────────────────────────────────── */
export function WorkbenchProvider({ children }: PropsWithChildren) {
  /* ── server data ── */
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [history, setHistory] = useState<SessionSummary[]>([]);
  const [parsers, setParsers] = useState<ParserDescriptor[]>([]);
  const [visionStatus, setVisionStatus] = useState<VisionStatus | null>(null);
  const [ruleManager, setRuleManager] = useState<OCRRuleManagerSnapshot | null>(null);
  const [correctionMemory, setCorrectionMemory] = useState<CorrectionMemoryEntry[]>([]);
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [projects, setProjects] = useState<OnboardingProject[]>([]);

  /* ── selection ── */
  const [selectedVariantKey, setSelectedVariantKey] = useState<string | null>(null);
  const [selectedDiagnosticRow, setSelectedDiagnosticRow] = useState<number | null>(null);

  /* ── row editor ── */
  const [rowEditorDate, setRowEditorDate] = useState("");
  const [rowEditorAmount, setRowEditorAmount] = useState("");
  const [rowEditorOperation, setRowEditorOperation] = useState("");
  const [rowEditorDetail, setRowEditorDetail] = useState("");
  const [rowEditorDirection, setRowEditorDirection] = useState<"inflow" | "outflow">("outflow");
  const [rowEditorNote, setRowEditorNote] = useState("");

  /* ── OCR review ── */
  const [selectedReviewTableIndex, setSelectedReviewTableIndex] = useState(0);
  const [selectedReviewHeaderRow, setSelectedReviewHeaderRow] = useState(0);
  const [reviewTitle, setReviewTitle] = useState("");
  const [saveReviewTemplate, setSaveReviewTemplate] = useState(true);
  const [reviewTemplateName, setReviewTemplateName] = useState("");
  const [reviewColumnMapping, setReviewColumnMapping] = useState<Record<string, string>>({});

  /* ── template editor ── */
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [templateIsDefault, setTemplateIsDefault] = useState(true);

  /* ── loading flags ── */
  const [isPending, startUpload] = useTransition();
  const [isSavingRowCorrection, setIsSavingRowCorrection] = useState(false);
  const [isMaterializingReview, setIsMaterializingReview] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);

  /* ── errors / toasts ── */
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const prevJobsRef = useRef<JobSummary[]>([]);

  const deferredPreview = useDeferredValue(preview);

  const allVariants = useMemo(
    () => [...(deferredPreview?.saved_variants ?? []), ...(deferredPreview?.variants ?? [])],
    [deferredPreview],
  );

  /* ─── Toast helpers ─── */
  const pushToast = useCallback((kind: Toast["kind"], message: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, kind, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  /* ─── Data loaders ─── */
  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/v1/transforms/history`);
      setHistory((await res.json()) as SessionSummary[]);
    } catch {
      // Backend unreachable — keep empty state
    }
  }, []);

  const loadParsers = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/v1/transforms/parsers`);
      setParsers((await res.json()) as ParserDescriptor[]);
    } catch {
      // Backend unreachable — keep empty state
    }
  }, []);

  const loadVisionStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/v1/transforms/vision-status`);
      setVisionStatus((await res.json()) as VisionStatus);
    } catch {
      // Backend unreachable — keep empty state
    }
  }, []);

  const loadRuleManager = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/v1/transforms/ocr-rule-manager`);
      setRuleManager((await res.json()) as OCRRuleManagerSnapshot);
    } catch {
      // Backend unreachable — keep empty state
    }
  }, []);

  const loadCorrectionMemory = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/v1/transforms/correction-memory`);
      setCorrectionMemory((await res.json()) as CorrectionMemoryEntry[]);
    } catch {
      // Backend unreachable — keep empty state
    }
  }, []);

  const loadJobs = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/v1/transforms/jobs`);
      const next = (await res.json()) as JobSummary[];
      setJobs((prev) => {
        // Notify on newly-completed jobs
        const prevMap = new Map(prev.map((j) => [j.job_id, j]));
        for (const job of next) {
          const was = prevMap.get(job.job_id);
          if (was && was.status !== "completed" && job.status === "completed") {
            pushToast("success", `Задача выполнена: ${job.source_filename ?? job.job_id}`);
          }
          if (was && was.status !== "failed" && job.status === "failed") {
            pushToast("error", `Ошибка задачи: ${job.source_filename ?? job.job_id}`);
          }
        }
        return next;
      });
      prevJobsRef.current = next;
    } catch {
      // Backend unreachable — skip update
    }
  }, [pushToast]);

  const loadProjects = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/v1/transforms/onboarding/projects`);
      setProjects((await res.json()) as OnboardingProject[]);
    } catch {
      // Backend unreachable — keep empty state
    }
  }, []);

  /* ─── Initial load ─── */
  useEffect(() => {
    startTransition(() => {
      void Promise.all([
        loadHistory(),
        loadParsers(),
        loadVisionStatus(),
        loadRuleManager(),
        loadCorrectionMemory(),
        loadJobs(),
        loadProjects(),
      ]).catch(() => {
        // Backend unreachable on startup — app continues with empty state
      });
    });
  }, [loadHistory, loadParsers, loadVisionStatus, loadRuleManager, loadCorrectionMemory, loadJobs, loadProjects]);

  /* ─── Job polling ─── */
  useEffect(() => {
    const id = window.setInterval(() => {
      void loadJobs().catch(() => {
        // Backend unreachable — skip this poll cycle
      });
    }, 8000);
    return () => window.clearInterval(id);
  }, [loadJobs]);

  /* ─── Auto-select variant ─── */
  useEffect(() => {
    if (!deferredPreview) return;
    const next =
      deferredPreview.default_variant_key ??
      deferredPreview.preference?.preferred_variant_key ??
      allVariants[0]?.key ??
      null;
    setSelectedVariantKey(next);
  }, [allVariants, deferredPreview]);

  /* ─── Sync row editor on diagnostic row change ─── */
  useEffect(() => {
    if (!selectedDiagnosticRow || !deferredPreview) return;
    const row = deferredPreview.row_diagnostics.find((r) => r.row_number === selectedDiagnosticRow);
    if (!row) return;
    setRowEditorDate(row.date);
    setRowEditorAmount(String(Math.abs(row.amount)));
    setRowEditorOperation(row.operation);
    setRowEditorDetail(row.detail);
    setRowEditorDirection(row.amount >= 0 ? "inflow" : "outflow");
    setRowEditorNote("");
  }, [selectedDiagnosticRow, deferredPreview]);

  /* ─── Sync OCR review state ─── */
  useEffect(() => {
    const review = deferredPreview?.ocr_review;
    if (!review) return;
    setSelectedReviewTableIndex(review.suggested_table_index ?? review.tables[0]?.table_index ?? 0);
    setSelectedReviewHeaderRow(review.suggested_header_row_index ?? 0);
    setReviewTitle(review.source_filename);
    setReviewTemplateName(review.source_filename.replace(/\.[^.]+$/, ""));
    setReviewColumnMapping(
      Object.fromEntries(review.available_fields.map((f) => [f.key, ""])),
    );
  }, [deferredPreview?.ocr_review]);

  /* ─── Actions ─── */
  const loadSession = useCallback(
    async (sessionId: string) => {
      setIsLoadingSession(true);
      setError(null);
      try {
        const res = await fetch(`${API}/api/v1/transforms/sessions/${sessionId}`);
        if (!res.ok) throw new Error(await res.text());
        setPreview((await res.json()) as PreviewResponse);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ошибка загрузки сессии.");
      } finally {
        setIsLoadingSession(false);
      }
    },
    [],
  );

  const handlePreviewNow = useCallback(
    (file: File) => {
      setError(null);
      startUpload(async () => {
        try {
          const fd = new FormData();
          fd.append("file", file);
          const res = await fetch(`${API}/api/v1/transforms/preview`, { method: "POST", body: fd });
          if (!res.ok) throw new Error(await res.text());
          setPreview((await res.json()) as PreviewResponse);
          await Promise.all([loadHistory(), loadCorrectionMemory(), loadJobs()]);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Ошибка обработки.");
        }
      });
    },
    [loadHistory, loadCorrectionMemory, loadJobs],
  );

  const handleQueueJob = useCallback(
    async (file: File) => {
      setError(null);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch(`${API}/api/v1/transforms/jobs/preview`, { method: "POST", body: fd });
        if (!res.ok) throw new Error(await res.text());
        pushToast("info", `В очередь: ${file.name}`);
        await loadJobs();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ошибка добавления в очередь.");
      }
    },
    [loadJobs, pushToast],
  );

  const handleExport = useCallback(async () => {
    if (!preview || !selectedVariantKey) return;
    setIsExporting(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/v1/transforms/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: preview.session_id, variant_key: selectedVariantKey }),
      });
      if (!res.ok) throw new Error(await res.text());
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
  }, [preview, selectedVariantKey]);

  const handleExportCsv = useCallback(async () => {
    if (!preview || !selectedVariantKey) return;
    setIsExportingCsv(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/v1/transforms/export/csv`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: preview.session_id, variant_key: selectedVariantKey }),
      });
      if (!res.ok) throw new Error(await res.text());
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
  }, [preview, selectedVariantKey]);

  const handleSaveRowCorrection = useCallback(async () => {
    if (!preview || !selectedDiagnosticRow) return;
    setIsSavingRowCorrection(true);
    setError(null);
    try {
      const res = await fetch(
        `${API}/api/v1/transforms/sessions/${preview.session_id}/rows/${selectedDiagnosticRow}`,
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
      if (!res.ok) throw new Error(await res.text());
      setPreview((await res.json()) as PreviewResponse);
      setSelectedDiagnosticRow(null);
      await loadCorrectionMemory();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сохранения исправления.");
    } finally {
      setIsSavingRowCorrection(false);
    }
  }, [preview, selectedDiagnosticRow, rowEditorDate, rowEditorAmount, rowEditorOperation, rowEditorDetail, rowEditorDirection, rowEditorNote, loadCorrectionMemory]);

  const handleMaterializeReview = useCallback(async () => {
    const review = preview?.ocr_review;
    if (!review) return;
    setIsMaterializingReview(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/v1/transforms/ocr-reviews/${review.review_id}/materialize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table_index: selectedReviewTableIndex,
          header_row_index: selectedReviewHeaderRow,
          title: reviewTitle,
          save_mapping_template: saveReviewTemplate,
          mapping_template_name: reviewTemplateName,
          column_mapping: Object.fromEntries(
            Object.entries(reviewColumnMapping).map(([k, v]) => [k, v === "" ? null : Number(v)]),
          ),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setPreview((await res.json()) as PreviewResponse);
      await Promise.all([loadHistory(), loadRuleManager(), loadJobs()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка применения OCR проверки.");
    } finally {
      setIsMaterializingReview(false);
    }
  }, [preview, selectedReviewTableIndex, selectedReviewHeaderRow, reviewTitle, saveReviewTemplate, reviewTemplateName, reviewColumnMapping, loadHistory, loadRuleManager, loadJobs]);

  const handleCreateTemplate = useCallback(async () => {
    if (!preview || !selectedVariantKey || !templateName.trim()) return;
    const baseVariant = preview.variants.find((v) => v.key === selectedVariantKey);
    if (!baseVariant) { setError("Шаблоны можно создавать только из базовых вариантов."); return; }
    setIsCreatingTemplate(true);
    setError(null);
    try {
      const columns: TemplateColumnConfig[] = baseVariant.columns.map((c) => ({
        key: c.key, label: c.label, kind: c.kind, enabled: true,
      }));
      const res = await fetch(`${API}/api/v1/transforms/templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parser_key: preview.document.parser_key,
          name: templateName,
          description: templateDescription,
          base_variant_key: baseVariant.key,
          is_default: templateIsDefault,
          columns,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      await loadSession(preview.session_id);
      setTemplateName("");
      setTemplateDescription("");
      setTemplateIsDefault(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка создания шаблона.");
    } finally {
      setIsCreatingTemplate(false);
    }
  }, [preview, selectedVariantKey, templateName, templateDescription, templateIsDefault, loadSession]);

  const handleToggleRule = useCallback(async (templateId: string, isActive: boolean) => {
    await fetch(`${API}/api/v1/transforms/ocr-mapping-templates/${templateId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: isActive }),
    });
    await loadRuleManager();
  }, [loadRuleManager]);

  const handleRollbackRule = useCallback(async (templateId: string) => {
    await fetch(`${API}/api/v1/transforms/ocr-mapping-templates/${templateId}/rollback`, { method: "POST" });
    await loadRuleManager();
  }, [loadRuleManager]);

  const handleCompareRule = useCallback(async (templateId: string): Promise<OCRRuleVersionDiff | null> => {
    const res = await fetch(`${API}/api/v1/transforms/ocr-mapping-templates/${templateId}/compare`);
    if (!res.ok) return null;
    return (await res.json()) as OCRRuleVersionDiff;
  }, []);

  const handleCreateProject = useCallback(async (name: string, bankName: string, notes: string) => {
    if (!name.trim() || !bankName.trim()) return;
    await fetch(`${API}/api/v1/transforms/onboarding/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, bank_name: bankName, notes }),
    });
    await loadProjects();
  }, [loadProjects]);

  const handleAttachCurrentResult = useCallback(async (projectId: string) => {
    if (!preview) return;
    await fetch(`${API}/api/v1/transforms/onboarding/projects/${projectId}/samples`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source_filename: preview.document.source_filename,
        review_id: preview.ocr_review?.review_id ?? null,
        session_id: preview.session_id || null,
        status: preview.ocr_review ? "mapping" : "validated",
        payload: { parser_key: preview.document.parser_key, applied_rule: preview.applied_rule },
      }),
    });
    await loadProjects();
  }, [preview, loadProjects]);

  const setReviewColumnMappingField = useCallback((field: string, value: string) => {
    setReviewColumnMapping((prev) => ({ ...prev, [field]: value }));
  }, []);

  const ctx: WorkbenchCtx = {
    preview,
    deferredPreview,
    allVariants,
    history,
    parsers,
    visionStatus,
    ruleManager,
    correctionMemory,
    jobs,
    projects,
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
    templateName,
    setTemplateName,
    templateDescription,
    setTemplateDescription,
    templateIsDefault,
    setTemplateIsDefault,
    isPending,
    isSavingRowCorrection,
    isMaterializingReview,
    isExporting,
    isExportingCsv,
    isLoadingSession,
    isCreatingTemplate,
    error,
    toasts,
    dismissToast,
    handlePreviewNow,
    handleQueueJob,
    handleExport,
    handleExportCsv,
    handleSaveRowCorrection,
    handleMaterializeReview,
    handleCreateTemplate,
    handleToggleRule,
    handleRollbackRule,
    handleCompareRule,
    handleCreateProject,
    handleAttachCurrentResult,
    loadSession,
  };

  return <Ctx.Provider value={ctx}>{children}</Ctx.Provider>;
}
