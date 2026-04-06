"use client";

import { useWorkbench } from "@/components/workbench/context";
import type { QualitySummary, RowDiagnostic } from "@/components/workbench/types";
import { formatPercent, severityClassName } from "@/components/workbench/utils";

type Props = {
  summary: QualitySummary | null;
  diagnostics: RowDiagnostic[];
};

export function QualityPanel({ summary, diagnostics }: Props) {
  const {
    selectedDiagnosticRow, setSelectedDiagnosticRow,
    rowEditorDate, setRowEditorDate,
    rowEditorAmount, setRowEditorAmount,
    rowEditorOperation, setRowEditorOperation,
    rowEditorDetail, setRowEditorDetail,
    rowEditorDirection, setRowEditorDirection,
    rowEditorNote, setRowEditorNote,
    isSavingRowCorrection,
    handleSaveRowCorrection,
  } = useWorkbench();

  if (!summary) return null;

  const conf = summary.overall_confidence;
  const confColor =
    conf >= 0.85 ? "text-emerald-400" : conf >= 0.65 ? "text-amber-400" : "text-rose-400";
  const anomalyBar = Math.round(summary.anomaly_score * 100);

  return (
    <section className="card p-4 sm:p-5 animate-fade-in">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            Контроль качества
          </h2>
          <p className="mt-0.5 text-sm" style={{ color: "var(--text-secondary)" }}>
            Флаги, уверенность и строки для проверки
          </p>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className={`text-3xl font-bold tabular-nums ${confColor}`}>
            {formatPercent(conf)}
          </span>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>общий</span>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 mb-4">
        <Metric label="Проверка" value={String(summary.review_required_count)} color="text-amber-400" />
        <Metric label="Высокий риск" value={String(summary.high_risk_count)} color="text-rose-400" />
        <Metric label="Исправлено" value={String(summary.corrected_count)} color="text-sky-400" />
        <Metric label="Чистые" value={String(summary.clean_count)} color="text-emerald-400" />
      </div>

      {/* Anomaly bar */}
      {summary.anomaly_score > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Индекс аномалий</p>
            <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{anomalyBar}%</p>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-hover)" }}>
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                anomalyBar > 40 ? "bg-rose-400" : anomalyBar > 15 ? "bg-amber-400" : "bg-emerald-400"
              }`}
              style={{ width: `${anomalyBar}%` }}
            />
          </div>
        </div>
      )}

      {/* Totals mismatch */}
      {summary.totals_mismatch && (
        <div className="mb-4 banner-amber px-4 py-3 text-xs">
          ⚠ Расхождение открытия/закрытия — проверьте чистый денежный поток.
        </div>
      )}

      {/* Recommendations */}
      {summary.recommendations.length > 0 && (
        <div className="mb-4 card-inner p-4">
          <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
            Рекомендации
          </p>
          <ul className="space-y-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
            {summary.recommendations.map((r) => (
              <li key={r} className="flex gap-2">
                <span style={{ color: "var(--text-muted)" }} className="mt-0.5">›</span>
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Row list */}
      <div className="space-y-2">
        {diagnostics.map((row) => (
          <div key={row.row_number}>
            <button
              className={`w-full text-left rounded-[var(--radius-inner)] border px-4 py-3 transition-colors ${
                selectedDiagnosticRow === row.row_number ? "" : ""
              }`}
              style={{
                background:
                  selectedDiagnosticRow === row.row_number
                    ? "rgba(59,130,246,0.08)"
                    : "var(--bg-raised)",
                borderColor:
                  selectedDiagnosticRow === row.row_number
                    ? "rgba(59,130,246,0.30)"
                    : "var(--border-subtle)",
              }}
              onClick={() =>
                setSelectedDiagnosticRow(
                  selectedDiagnosticRow === row.row_number ? null : row.row_number,
                )
              }
              type="button"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                  <span className="mr-2" style={{ color: "var(--text-muted)" }}>#{row.row_number}</span>
                  {row.detail || row.operation}
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
                    {row.amount > 0 ? "+" : ""}
                    {row.amount.toLocaleString("ru-RU", { minimumFractionDigits: 2 })}
                  </span>
                  <span className={`badge text-[0.62rem] ${
                    row.confidence >= 0.9 ? "badge-emerald"
                    : row.confidence >= 0.7 ? "badge-amber"
                    : "badge-rose"
                  }`}>
                    {formatPercent(row.confidence)}
                  </span>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {row.flags.length ? (
                  row.flags.map((flag) => (
                    <span
                      key={flag.code}
                      className={`badge text-[0.62rem] ${severityClassName(flag.severity)}`}
                    >
                      {flag.message}
                    </span>
                  ))
                ) : (
                  <span className="badge badge-emerald text-[0.62rem]">Чистая</span>
                )}
              </div>
            </button>

            {/* Inline editor */}
            {selectedDiagnosticRow === row.row_number && (
              <div
                className="mt-1 ml-2 sm:ml-3 rounded-[var(--radius-inner)] border p-4 animate-slide-up"
                style={{
                  background: "rgba(59,130,246,0.05)",
                  borderColor: "rgba(59,130,246,0.20)",
                }}
              >
                <p className="text-xs font-semibold mb-3 text-blue-400">
                  Редактировать строку {row.row_number}
                </p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  <LabelInput label="Дата" value={rowEditorDate} onChange={setRowEditorDate} />
                  <LabelInput label="Сумма" value={rowEditorAmount} onChange={setRowEditorAmount} type="number" />
                  <label className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    Направление
                    <select
                      className="input-field mt-1"
                      value={rowEditorDirection}
                      onChange={(e) => setRowEditorDirection(e.target.value as "inflow" | "outflow")}
                    >
                      <option value="inflow">Приход</option>
                      <option value="outflow">Расход</option>
                    </select>
                  </label>
                  <LabelInput label="Операция" value={rowEditorOperation} onChange={setRowEditorOperation} />
                  <LabelInput label="Детали / Контрагент" value={rowEditorDetail} onChange={setRowEditorDetail} />
                  <LabelInput label="Примечание (необяз.)" value={rowEditorNote} onChange={setRowEditorNote} />
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    className="btn-primary text-xs"
                    disabled={isSavingRowCorrection}
                    onClick={handleSaveRowCorrection}
                    type="button"
                  >
                    {isSavingRowCorrection ? "Сохранение…" : "Сохранить исправление"}
                  </button>
                  <button
                    className="btn-ghost text-xs"
                    onClick={() => setSelectedDiagnosticRow(null)}
                    type="button"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="card-inner p-3 text-center">
      <p className="text-[10px] uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
      <p className={`mt-1 text-xl font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}

function LabelInput({
  label, value, onChange, type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="text-xs" style={{ color: "var(--text-secondary)" }}>
      {label}
      <input
        className="input-field mt-1"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
