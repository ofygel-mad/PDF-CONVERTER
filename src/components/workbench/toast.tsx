"use client";

import { useWorkbench } from "@/components/workbench/context";

const ICONS = {
  info:    "○",
  success: "✓",
  error:   "✕",
};

const COLORS = {
  info:    "banner-sky",
  success: "banner-emerald",
  error:   "banner-rose",
};

export function ToastContainer() {
  const { toasts, dismissToast } = useWorkbench();

  if (!toasts.length) return null;

  return (
    <div
      className="fixed z-50 flex flex-col gap-2"
      style={{
        bottom: "1.25rem",
        right: "1rem",
        left: "1rem",
        maxWidth: "360px",
        marginLeft: "auto",
        marginRight: "auto",
      }}
      role="region"
      aria-label="Уведомления"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`animate-toast-in flex items-start gap-3 px-4 py-3 shadow-lg ${COLORS[toast.kind]}`}
          style={{ borderRadius: "var(--radius-inner)" }}
        >
          <span className="mt-0.5 text-sm font-bold flex-shrink-0">
            {ICONS[toast.kind]}
          </span>
          <p className="flex-1 text-sm leading-snug">{toast.message}</p>
          <button
            aria-label="Закрыть"
            className="ml-1 flex-shrink-0"
            style={{ opacity: 0.6 }}
            onClick={() => dismissToast(toast.id)}
            type="button"
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.6"; }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
