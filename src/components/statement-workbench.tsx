"use client";

import { useEffect, useState } from "react";

import { WorkbenchProvider, useWorkbench } from "@/components/workbench/context";
import { ToastContainer } from "@/components/workbench/toast";
import { UploadPanel } from "@/components/workbench/upload-panel";
import { HistoryPanel } from "@/components/workbench/history-panel";
import { QualityPanel } from "@/components/workbench/quality-panel";
import { VariantPreviewPanel } from "@/components/workbench/variant-preview-panel";
import { OcrReviewPanel } from "@/components/workbench/ocr-review-panel";

type Tab = "table" | "quality" | "ocr";

const TABS: { key: Tab; label: string; shortLabel: string; icon: string }[] = [
  { key: "table", label: "Транзакции", shortLabel: "Список", icon: "📊" },
  { key: "quality", label: "Качество", shortLabel: "Качество", icon: "⚠️" },
  { key: "ocr", label: "Распознавание", shortLabel: "Скан", icon: "📄" },
];

type Theme = "dark" | "light" | "system";

function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("theme") as Theme | null;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTheme(stored === "dark" || stored === "light" ? stored : "system");
    } catch {
      // ignore
    }
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
    } catch {
      // ignore
    }
  };

  const icons: Record<Theme, string> = { dark: "🌙", light: "☀️", system: "⚙️" };
  const labels: Record<Theme, string> = { dark: "Тёмная", light: "Светлая", system: "Авто" };

  return (
    <button
      onClick={cycle}
      className="btn-ghost text-xs px-2.5 py-1.5 flex items-center gap-1.5"
      type="button"
      title={`Тема: ${labels[theme]}`}
    >
      <span>{icons[theme]}</span>
      <span className="hidden sm:inline">{labels[theme]}</span>
    </button>
  );
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full flex-shrink-0 ${ok ? "bg-emerald-400" : "bg-slate-600"}`}
    />
  );
}

function WorkbenchInner() {
  const {
    deferredPreview,
    allVariants,
    history,
    parsers,
    error,
    isLoadingSession,
    loadSession,
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
    isMaterializingReview,
    handleMaterializeReview,
    templateName,
    setTemplateName,
    templateDescription,
    setTemplateDescription,
    templateIsDefault,
    setTemplateIsDefault,
    isCreatingTemplate,
    handleCreateTemplate,
  } = useWorkbench();

  const [tab, setTab] = useState<Tab>("table");
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const hasPreview = Boolean(deferredPreview?.session_id);
  const hasOcrReview = Boolean(deferredPreview?.ocr_review);

  const visibleTabs = TABS.filter((item) => {
    if (item.key === "quality" && !hasPreview) return false;
    if (item.key === "ocr" && !hasOcrReview) return false;
    return true;
  });

  const tabBadge = (key: Tab): string | null => {
    if (key === "quality" && deferredPreview?.quality_summary.high_risk_count) {
      return String(deferredPreview.quality_summary.high_risk_count);
    }
    if (key === "ocr" && hasOcrReview) return "!";
    return null;
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--page-bg)" }}>
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
          <button
            onClick={() => setShowHistory((value) => !value)}
            className="btn-ghost text-xs px-2.5 py-1.5 flex items-center gap-1.5"
            type="button"
            title="История сессий"
          >
            <span>⏱</span>
            <span className="hidden sm:inline">История</span>
          </button>
          <ThemeToggle />
        </div>
      </header>

      <div className="hidden sm:block max-w-6xl w-full mx-auto px-6">
        <nav className="flex" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          {visibleTabs.map((item) => {
            const badge = tabBadge(item.key);
            return (
              <button
                key={item.key}
                className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap flex items-center gap-1.5 ${
                  tab === item.key ? "tab-active" : "tab-inactive"
                }`}
                onClick={() => setTab(item.key)}
                type="button"
              >
                {item.label}
                {badge && <span className="badge badge-rose text-[0.6rem]">{badge}</span>}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="px-4 pt-4 pb-2 max-w-6xl w-full mx-auto">
        <UploadPanel file={localFile} parsers={parsers} onFileChange={setLocalFile} />
      </div>

      {error && (
        <div className="mx-4 mb-2 max-w-6xl mx-auto rounded-2xl banner-rose px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <main className="flex-1 px-4 sm:px-6 py-4 sm:py-5 max-w-6xl w-full mx-auto space-y-4 pb-24 sm:pb-8">
        {tab === "table" && !hasPreview && (
          <div className="animate-fade-in flex flex-col items-center justify-center py-20 text-center">
            <div className="text-5xl mb-4 opacity-20" style={{ color: "var(--text-muted)" }}>📁</div>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Загрузите файл выписки для анализа</p>
            <p className="text-xs mt-2" style={{ color: "var(--text-muted)", opacity: 0.7 }}>
              Или{" "}
              <button
                className="underline underline-offset-2"
                style={{ color: "var(--accent-blue)" }}
                onClick={() => setShowHistory(true)}
                type="button"
              >
                откройте историю сессий
              </button>
            </p>
          </div>
        )}

        {tab === "table" && hasPreview && (
          <div className="space-y-4 animate-fade-in">
            <VariantPreviewPanel variants={allVariants} diagnostics={deferredPreview?.row_diagnostics ?? []} />
            <div className="card p-4 sm:p-5">
              <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
                Сохранить шаблон
              </h3>
              <div className="grid gap-2 sm:grid-cols-2 mb-3">
                <input className="input-field" placeholder="Название" value={templateName} onChange={(e) => setTemplateName(e.target.value)} />
                <input className="input-field" placeholder="Описание" value={templateDescription} onChange={(e) => setTemplateDescription(e.target.value)} />
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: "var(--text-secondary)" }}>
                  <input type="checkbox" checked={templateIsDefault} onChange={(e) => setTemplateIsDefault(e.target.checked)} className="accent-blue-500" />
                  По умолчанию
                </label>
                <button className="btn-ghost text-xs" disabled={isCreatingTemplate || !templateName.trim()} onClick={handleCreateTemplate} type="button">
                  {isCreatingTemplate ? "Сохранение…" : "Сохранить"}
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === "quality" && hasPreview && (
          <div className="animate-fade-in">
            <QualityPanel summary={deferredPreview?.quality_summary ?? null} diagnostics={deferredPreview?.row_diagnostics ?? []} />
          </div>
        )}

        {tab === "ocr" && (
          <div className="animate-fade-in">
            {hasOcrReview ? (
              <OcrReviewPanel
                busy={isMaterializingReview}
                columnMapping={reviewColumnMapping}
                onColumnMappingChange={setReviewColumnMappingField}
                onHeaderRowChange={setSelectedReviewHeaderRow}
                onMaterialize={handleMaterializeReview}
                onReviewTemplateNameChange={setReviewTemplateName}
                onReviewTitleChange={setReviewTitle}
                onSaveTemplateChange={setSaveReviewTemplate}
                onTableChange={setSelectedReviewTableIndex}
                review={deferredPreview?.ocr_review ?? null}
                reviewTemplateName={reviewTemplateName}
                reviewTitle={reviewTitle}
                saveTemplate={saveReviewTemplate}
                selectedHeaderRow={selectedReviewHeaderRow}
                selectedTableIndex={selectedReviewTableIndex}
              />
            ) : (
              <div className="card p-10 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                Распознавание не требуется для этого документа.
              </div>
            )}
          </div>
        )}
      </main>

      {showHistory && (
        <>
          <div
            className="fixed inset-0 z-40"
            style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(3px)" }}
            onClick={() => setShowHistory(false)}
          />
          <aside
            className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-md flex flex-col overflow-hidden"
            style={{ background: "var(--surface)", borderLeft: "1px solid var(--border-subtle)" }}
          >
            <div
              className="sticky top-0 flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
              style={{ background: "var(--header-bg)", borderColor: "var(--border-subtle)" }}
            >
              <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                История сессий
              </span>
              <button
                className="btn-ghost text-base px-2 py-1"
                onClick={() => setShowHistory(false)}
                type="button"
                aria-label="Закрыть"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-8">
              <HistoryPanel
                history={history}
                loading={isLoadingSession}
                onOpen={(id) => { loadSession(id); setTab("table"); setShowHistory(false); }}
              />
            </div>
          </aside>
        </>
      )}

      <nav
        className="sm:hidden fixed bottom-0 inset-x-0 z-50 flex border-t"
        style={{
          background: "var(--header-bg)",
          borderColor: "var(--border-subtle)",
          backdropFilter: "blur(12px)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {visibleTabs.map((item) => {
          const badge = tabBadge(item.key);
          const active = tab === item.key;
          return (
            <button
              key={item.key}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 relative"
              style={{
                color: active ? "var(--accent-blue)" : "var(--text-muted)",
                minHeight: "56px",
              }}
              onClick={() => setTab(item.key)}
              type="button"
            >
              <span className="text-lg leading-none">{item.icon}</span>
              <span className="text-[10px] leading-tight">{item.shortLabel}</span>
              {badge && (
                <span className="absolute top-1.5 right-1/4 h-4 w-4 rounded-full bg-rose-500 text-white text-[9px] flex items-center justify-center font-bold">
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

type StatementWorkbenchProps = {
  apiBaseUrl: string;
};

export function StatementWorkbench({ apiBaseUrl }: StatementWorkbenchProps) {
  return (
    <WorkbenchProvider apiBaseUrl={apiBaseUrl}>
      <WorkbenchInner />
    </WorkbenchProvider>
  );
}
