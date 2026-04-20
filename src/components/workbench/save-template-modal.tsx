"use client";

import { useState } from "react";

import { useWorkbench } from "@/components/workbench/context";
import type { TemplateColumnConfig } from "@/components/workbench/types";

type Props = {
  parserKey: string;
  variantKey: string;
  columns: TemplateColumnConfig[];
  onClose: () => void;
  onSaved: (templateId: string) => void;
};

export function SaveTemplateModal({ parserKey, variantKey, columns, onClose, onSaved }: Props) {
  const { handleCreateTemplate } = useWorkbench();
  const [name, setName] = useState(`${parserKey} — мой формат`);
  const [applyByDefault, setApplyByDefault] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim()) return;
    setIsSaving(true);
    setError(null);
    const templateId = await handleCreateTemplate(name.trim(), parserKey, variantKey, columns);
    setIsSaving(false);
    if (!templateId) {
      setError("Не удалось сохранить шаблон. Попробуйте ещё раз.");
      return;
    }
    if (applyByDefault) {
      try {
        localStorage.setItem(`template_id_${parserKey}`, templateId);
      } catch {
        // ignore
      }
    }
    onSaved(templateId);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 space-y-4"
        style={{ background: "var(--surface)", border: "1px solid var(--border-base)" }}
      >
        <div>
          <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            Сохранить шаблон
          </h3>
          <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
            Настройки колонок будут применяться к будущим документам этого типа.
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
            Название шаблона
          </label>
          <input
            className="w-full rounded-lg px-3 py-2 text-sm"
            style={{
              background: "var(--bg-hover)",
              border: "1px solid var(--border-base)",
              color: "var(--text-primary)",
              outline: "none",
            }}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void handleSave(); }}
            autoFocus
          />
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={applyByDefault}
            onChange={(e) => setApplyByDefault(e.target.checked)}
            className="rounded"
          />
          <span className="text-sm" style={{ color: "var(--text-primary)" }}>
            Применять для будущих файлов этого банка
          </span>
        </label>

        {error && (
          <p className="text-xs" style={{ color: "var(--rose-500, #f43f5e)" }}>{error}</p>
        )}

        <div className="flex gap-2 justify-end pt-1">
          <button
            className="btn-ghost px-4 py-2 text-sm"
            onClick={onClose}
            type="button"
            disabled={isSaving}
          >
            Отмена
          </button>
          <button
            className="btn-primary px-4 py-2 text-sm"
            onClick={() => void handleSave()}
            type="button"
            disabled={isSaving || !name.trim()}
          >
            {isSaving ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}
