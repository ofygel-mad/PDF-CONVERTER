"use client";

import { useRef, useState } from "react";

import { useWorkbench } from "@/components/workbench/context";
import type { ParserDescriptor } from "@/components/workbench/types";

const ACCEPTED = ".pdf,.xlsx,.xlsm,.png,.jpg,.jpeg";
const ACCEPTED_EXT = new Set([".pdf", ".xlsx", ".xlsm", ".png", ".jpg", ".jpeg"]);

function isValid(file: File) {
  return ACCEPTED_EXT.has(`.${(file.name.split(".").pop() ?? "").toLowerCase()}`);
}

function cleanLabel(label: string) {
  return label
    .replace(/\bStatement\b/gi, "")
    .replace(/\bScanned\b/gi, "Сканы")
    .replace(/\bGeneric Bank\b/gi, "Другие банки")
    .replace(/\s{2,}/g, " ")
    .trim();
}

type Props = {
  file: File | null;
  parsers: ParserDescriptor[];
  onFileChange: (f: File | null) => void;
};

export function UploadPanel({ file, parsers, onFileChange }: Props) {
  const { isPending, handlePreviewNow } = useWorkbench();
  const [dragging, setDragging] = useState(false);
  const [showFormats, setShowFormats] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const systemReady = parsers.length > 0;

  return (
    <section className="card p-4 animate-fade-in">
      <input
        ref={inputRef}
        accept={ACCEPTED}
        className="hidden"
        type="file"
        onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
      />

      <div
        role="button"
        tabIndex={0}
        aria-label="Загрузить файл"
        className="rounded-[var(--radius-inner)] border-2 border-dashed transition-all duration-150 select-none cursor-pointer"
        style={{
          borderColor: dragging ? "var(--accent-blue)" : file ? "rgba(16,185,129,0.40)" : "var(--border-base)",
          background: dragging ? "rgba(59,130,246,0.07)" : file ? "rgba(16,185,129,0.05)" : "var(--bg-raised)",
          padding: file ? "0.75rem 1rem" : "1.25rem 1rem",
        }}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const dropped = e.dataTransfer.files[0];
          if (dropped && isValid(dropped)) onFileChange(dropped);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
      >
        {file ? (
          <div className="flex items-center gap-3">
            <span className="text-2xl flex-shrink-0">📄</span>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-semibold truncate text-emerald-400">{file.name}</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {(file.size / 1024).toFixed(0)} КБ · нажмите для замены
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5 text-center">
            <span className="text-3xl" style={{ opacity: 0.25 }}>{dragging ? "📥" : "📁"}</span>
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              {dragging ? "Отпустите файл" : "Нажмите или перетащите файл"}
            </p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              PDF, Excel, изображения
            </p>
          </div>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <button
          className="btn-primary flex-1"
          disabled={!file || isPending}
          onClick={() => file && handlePreviewNow(file)}
          type="button"
        >
          {isPending ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin-slow flex-shrink-0" />
              Обработка…
            </span>
          ) : "Анализировать"}
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
          <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${systemReady ? "bg-emerald-400" : "bg-slate-500"}`} />
          {systemReady ? "Система готова" : "Сервер недоступен"}
        </div>
        <button
          className="text-xs flex items-center gap-1"
          style={{ color: "var(--text-muted)" }}
          onClick={() => setShowFormats((value) => !value)}
          type="button"
        >
          <span style={{
            display: "inline-block",
            transition: "transform 0.2s",
            transform: showFormats ? "rotate(90deg)" : "none",
          }}>›</span>
          Форматы
        </button>
      </div>

      {showFormats && (
        <div className="mt-2 card-inner p-3 animate-slide-up">
          <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>
            Поддерживаемые форматы
          </p>
          <ul className="space-y-1.5">
            {parsers.map((parser) => (
              <li key={parser.key} className="flex items-center gap-2 text-xs">
                <span className="flex gap-1 flex-shrink-0">
                  {parser.accepted_extensions.slice(0, 2).map((ext) => (
                    <span key={ext} className="badge badge-slate">{ext}</span>
                  ))}
                </span>
                <span className="truncate" style={{ color: "var(--text-secondary)" }}>
                  {cleanLabel(parser.label)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
