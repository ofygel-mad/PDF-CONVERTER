"use client";

import { useState } from "react";
import Link from "next/link";

import { AutocallModal } from "@/components/services/autocall-modal";

type ServiceTile = {
  key: string;
  title: string;
  description: string;
  icon: string;
};

const TILES: ServiceTile[] = [
  {
    key: "autocall",
    title: "Autocall.kz",
    description: "Фактическая стоимость и дата обзвонов → Google Sheets",
    icon: "📞",
  },
];

export function ServicesClient() {
  const [openService, setOpenService] = useState<string | null>(null);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--page-bg)" }}>
      <header
        className="sticky top-0 z-40 flex items-center justify-between gap-2 px-4 py-2.5 border-b backdrop-blur-md"
        style={{ background: "var(--header-bg)", borderColor: "var(--border-subtle)" }}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
            Сервисы
          </span>
        </div>
        <Link href="/" className="btn-ghost text-xs px-2.5 py-1.5 flex items-center gap-1.5" title="На главную">
          <span>←</span>
          <span className="hidden sm:inline">Назад</span>
        </Link>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-5 py-6">
        <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
          Внешние сервисы, из которых мы тянем данные для формирования таблиц.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {TILES.map((tile) => (
            <button
              key={tile.key}
              type="button"
              onClick={() => setOpenService(tile.key)}
              className="text-left rounded-2xl p-5 transition-colors flex flex-col gap-2 hover:opacity-90"
              style={{ background: "var(--surface)", border: "1px solid var(--border-base)" }}
            >
              <span className="text-2xl">{tile.icon}</span>
              <span className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
                {tile.title}
              </span>
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {tile.description}
              </span>
            </button>
          ))}
        </div>
      </main>

      {openService === "autocall" && <AutocallModal onClose={() => setOpenService(null)} />}
    </div>
  );
}
