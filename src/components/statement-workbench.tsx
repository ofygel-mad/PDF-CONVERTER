"use client";

import { useEffect, useState } from "react";

import { WorkbenchProvider, useWorkbench } from "@/components/workbench/context";
import { ToastContainer } from "@/components/workbench/toast";
import { UploadPanel } from "@/components/workbench/upload-panel";
import { OverviewPanel } from "@/components/workbench/overview-panel";
import { HistoryPanel } from "@/components/workbench/history-panel";
import { QualityPanel } from "@/components/workbench/quality-panel";
import { VariantPreviewPanel } from "@/components/workbench/variant-preview-panel";
import { OcrReviewPanel } from "@/components/workbench/ocr-review-panel";
import { RuleManagerPanel } from "@/components/workbench/rule-manager-panel";
import { OnboardingPanel } from "@/components/workbench/onboarding-panel";
import { CorrectionMemoryPanel } from "@/components/workbench/correction-memory-panel";
import { JobsPanel } from "@/components/workbench/jobs-panel";

type Tab = "overview" | "table" | "quality" | "ocr" | "rules" | "history";

const TABS: { key: Tab; label: string; shortLabel: string; icon: string }[] = [
  { key: "overview", label: "Обзор",       shortLabel: "Обзор",    icon: "◈" },
  { key: "table",    label: "Транзакции",   shortLabel: "Список",   icon: "≡" },
  { key: "quality",  label: "Качество",     shortLabel: "Качество", icon: "◎" },
  { key: "ocr",      label: "Распознавание",shortLabel: "Скан",     icon: "⬚" },
  { key: "rules",    label: "Правила",      shortLabel: "Правила",  icon: "⚙" },
  { key: "history",  label: "История",      shortLabel: "История",  icon: "↺" },
];

/* ─── Theme toggle ─── */
type Theme = "dark" | "light" | "system";

function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("theme") as Theme | null;
      setTheme(stored === "dark" || stored === "light" ? stored : "system");
    } catch { /* ignore */ }
  }, []);

  const cycle = () => {
    const next: Theme = theme === "dark" ? "light" : theme === "light" ? "system" : "dark";
    setTheme(next);
    try {
      if (next === "system") {
        localStorage.removeItem("theme");
        const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
      } else {
        localStorage.setItem("theme", next);
        document.documentElement.setAttribute("data-theme", next);
      }
    } catch { /* ignore */ }
  };

  const ICONS: Record<Theme, string> = { dark: "🌙", light: "☀️", system: "⚙" };
  const LABELS: Record<Theme, string> = { dark: "Тёмная", light: "Светлая", system: "Авто" };

  return (
    <button
      onClick={cycle}
      className="btn-ghost text-xs px-2.5 py-1.5 flex items-center gap-1.5"
      type="button"
      title={`Тема: ${LABELS[theme]}`}
    >
      <span>{ICONS[theme]}</span>
      <span className="hidden sm:inline">{LABELS[theme]}</span>
    </button>
  );
}

/* ─── Status dot ─── */
function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full flex-shrink-0 ${ok ? "bg-emerald-400" : "bg-slate-600"}`}
    />
  );
}

/* ─── Main inner ─── */
function WorkbenchInner() {
  const {
    deferredPreview, allVariants, history, parsers, visionStatus,
    ruleManager, correctionMemory, jobs, projects,
    error, isLoadingSession, loadSession,
    handleToggleRule, handleRollbackRule, handleCompareRule,
    handleCreateProject, handleAttachCurrentResult,
    selectedReviewTableIndex, setSelectedReviewTableIndex,
    selectedReviewHeaderRow, setSelectedReviewHeaderRow,
    reviewTitle, setReviewTitle,
    saveReviewTemplate, setSaveReviewTemplate,
    reviewTemplateName, setReviewTemplateName,
    reviewColumnMapping, setReviewColumnMappingField,
    isMaterializingReview, handleMaterializeReview,
    templateName, setTemplateName,
    templateDescription, setTemplateDescription,
    templateIsDefault, setTemplateIsDefault,
    isCreatingTemplate, handleCreateTemplate,
  } = useWorkbench();

  const [tab, setTab] = useState<Tab>("overview");
  const [localFile, setLocalFile] = useState<File | null>(null);

  const hasPreview   = Boolean(deferredPreview?.session_id);
  const hasOcrReview = Boolean(deferredPreview?.ocr_review);
  const activeJobs   = jobs.filter((j) => j.status === "running" || j.status === "queued");

  const visibleTabs = TABS.filter((t) => {
    if (t.key === "table"   && !hasPreview)   return false;
    if (t.key === "quality" && !hasPreview)   return false;
    if (t.key === "ocr"     && !hasOcrReview) return false;
    return true;
  });

  /* Badge helpers */
  const tabBadge = (key: Tab): string | null => {
    if (key === "quality" && deferredPreview?.quality_summary.high_risk_count)
      return String(deferredPreview.quality_summary.high_risk_count);
    if (key === "ocr" && hasOcrReview) return "!";
    return null;
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--page-bg)" }}
    >
      {/* ── Header ── */}
      <header
        className="sticky top-0 z-40 flex items-center justify-between gap-2 px-4 py-2.5 border-b backdrop-blur-md"
        style={{ background: "var(--header-bg)", borderColor: "var(--border-subtle)" }}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="text-sm font-bold whitespace-nowrap" style={{ color: "var(--text-primary)" }}>
            Анализатор выписок
          </span>
          <span className="hidden sm:flex items-center gap-1.5 text-xs whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
            <StatusDot ok={parsers.length > 0} />
            {parsers.length > 0 ? `${parsers.length} форм.` : "офлайн"}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {activeJobs.length > 0 && (
            <span className="flex items-center gap-1 text-xs text-amber-300 whitespace-nowrap">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
              <span className="hidden sm:inline">{activeJobs.length} задач</span>
            </span>
          )}
          <ThemeToggle />
        </div>
      </header>

      {/* ── Desktop tab bar (hidden on mobile) ── */}
      <div className="hidden sm:block max-w-6xl w-full mx-auto px-6">
        <nav className="flex" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          {visibleTabs.map((t) => {
            const badge = tabBadge(t.key);
            return (
              <button
                key={t.key}
                className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap flex items-center gap-1.5 ${
                  tab === t.key ? "tab-active" : "tab-inactive"
                }`}
                onClick={() => setTab(t.key)}
                type="button"
              >
                {t.label}
                {badge && <span className="badge badge-rose text-[0.6rem]">{badge}</span>}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ── Upload zone ── */}
      <div className="px-4 pt-4 pb-2 max-w-6xl w-full mx-auto">
        <UploadPanel
          file={localFile}
          parsers={parsers}
          visionStatus={visionStatus}
          onFileChange={setLocalFile}
        />
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div className="mx-4 mb-2 max-w-6xl mx-auto rounded-2xl banner-rose px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* ── Tab content ── */}
      {/* pb-24 on mobile leaves space for bottom nav */}
      <main className="flex-1 px-4 sm:px-6 py-4 sm:py-5 max-w-6xl w-full mx-auto space-y-4 pb-24 sm:pb-8">

        {tab === "overview" && (
          <div className="space-y-4 animate-fade-in">
            <OverviewPanel preview={deferredPreview} />
            {!hasPreview && (
              <div className="grid gap-4 xl:grid-cols-2">
                <HistoryPanel history={history} loading={isLoadingSession}
                  onOpen={(id) => { loadSession(id); setTab("table"); }} />
                <div className="space-y-4">
                  <JobsPanel jobs={jobs} onOpenSession={(id) => { loadSession(id); setTab("table"); }} />
                  <CorrectionMemoryPanel entries={correctionMemory} />
                </div>
              </div>
            )}
            {hasPreview && (
              <div className="card p-4 sm:p-5">
                <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
                  Сохранить шаблон
                </h3>
                <div className="grid gap-2 sm:grid-cols-2 mb-3">
                  <input className="input-field" placeholder="Название" value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)} />
                  <input className="input-field" placeholder="Описание" value={templateDescription}
                    onChange={(e) => setTemplateDescription(e.target.value)} />
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: "var(--text-secondary)" }}>
                    <input type="checkbox" checked={templateIsDefault}
                      onChange={(e) => setTemplateIsDefault(e.target.checked)} className="accent-blue-500" />
                    По умолчанию
                  </label>
                  <button className="btn-ghost text-xs" disabled={isCreatingTemplate || !templateName.trim()}
                    onClick={handleCreateTemplate} type="button">
                    {isCreatingTemplate ? "Сохранение…" : "Сохранить"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "table" && hasPreview && (
          <div className="animate-fade-in">
            <VariantPreviewPanel variants={allVariants} diagnostics={deferredPreview?.row_diagnostics ?? []} />
          </div>
        )}

        {tab === "quality" && hasPreview && (
          <div className="animate-fade-in">
            <QualityPanel summary={deferredPreview?.quality_summary ?? null}
              diagnostics={deferredPreview?.row_diagnostics ?? []} />
          </div>
        )}

        {tab === "ocr" && (
          <div className="animate-fade-in">
            {hasOcrReview ? (
              <OcrReviewPanel
                busy={isMaterializingReview} columnMapping={reviewColumnMapping}
                onColumnMappingChange={setReviewColumnMappingField}
                onHeaderRowChange={setSelectedReviewHeaderRow}
                onMaterialize={handleMaterializeReview}
                onReviewTemplateNameChange={setReviewTemplateName}
                onReviewTitleChange={setReviewTitle}
                onSaveTemplateChange={setSaveReviewTemplate}
                onTableChange={setSelectedReviewTableIndex}
                review={deferredPreview?.ocr_review ?? null}
                reviewTemplateName={reviewTemplateName} reviewTitle={reviewTitle}
                saveTemplate={saveReviewTemplate} selectedHeaderRow={selectedReviewHeaderRow}
                selectedTableIndex={selectedReviewTableIndex}
              />
            ) : (
              <div className="card p-10 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                Распознавание не требуется для этого документа.
              </div>
            )}
          </div>
        )}

        {tab === "rules" && (
          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr] animate-fade-in">
            <RuleManagerPanel loading={false}
              onCompare={(t) => handleCompareRule(t.template_id)}
              onRollback={(t) => void handleRollbackRule(t.template_id)}
              onToggle={(t, active) => void handleToggleRule(t.template_id, active)}
              snapshot={ruleManager} />
            <OnboardingPanel
              onAttachCurrentResult={(id) => void handleAttachCurrentResult(id)}
              onCreateProject={(name, bank, notes) => void handleCreateProject(name, bank, notes)}
              projects={projects} />
          </div>
        )}

        {tab === "history" && (
          <div className="grid gap-4 xl:grid-cols-2 animate-fade-in">
            <HistoryPanel history={history} loading={isLoadingSession}
              onOpen={(id) => { loadSession(id); setTab("table"); }} />
            <div className="space-y-4">
              <JobsPanel jobs={jobs} onOpenSession={(id) => { loadSession(id); setTab("table"); }} />
              <CorrectionMemoryPanel entries={correctionMemory} />
            </div>
          </div>
        )}
      </main>

      {/* ── Mobile bottom navigation ── */}
      <nav
        className="sm:hidden fixed bottom-0 inset-x-0 z-50 flex border-t"
        style={{
          background: "var(--header-bg)",
          borderColor: "var(--border-subtle)",
          backdropFilter: "blur(12px)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {visibleTabs.map((t) => {
          const badge = tabBadge(t.key);
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 relative"
              style={{
                color: active ? "var(--accent-blue)" : "var(--text-muted)",
                minHeight: "56px",
              }}
              onClick={() => setTab(t.key)}
              type="button"
            >
              <span className="text-lg leading-none">{t.icon}</span>
              <span className="text-[10px] leading-tight">{t.shortLabel}</span>
              {badge && (
                <span
                  className="absolute top-1.5 right-1/4 h-4 w-4 rounded-full bg-rose-500 text-white text-[9px] flex items-center justify-center font-bold"
                >
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <ToastContainer />
    </div>
  );
}

export function StatementWorkbench() {
  return (
    <WorkbenchProvider>
      <WorkbenchInner />
    </WorkbenchProvider>
  );
}
