"use client";

import { useState } from "react";
import Link from "next/link";
import type { ComponentType } from "react";

import { AutocallModal } from "@/components/services/autocall-modal";
import { ArrowLeftIcon, PhoneIcon, PuzzleIcon } from "@/components/icons";

type ServiceTile = {
  key: string;
  title: string;
  description: string;
  Icon: ComponentType<{ size?: number }>;
};

const TILES: ServiceTile[] = [
  {
    key: "autocall",
    title: "Autocall.kz",
    description: "Фактическая стоимость и дата обзвонов → Google Sheets",
    Icon: PhoneIcon,
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
        <div className="flex items-center gap-2.5">
          <Link href="/" className="btn-ghost text-xs px-2.5 py-1.5 flex items-center gap-1.5" title="На главную">
            <ArrowLeftIcon size={15} />
            <span className="hidden sm:inline">Назад</span>
          </Link>
          <span className="logo-badge">
            <PuzzleIcon size={16} />
          </span>
          <span className="text-sm font-semibold" style={{ color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
            Сервисы
          </span>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-5 py-10">
        <p className="eyebrow mb-2">Интеграции</p>
        <h1 className="text-2xl font-semibold mb-2" style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
          Источники данных
        </h1>
        <p className="text-sm mb-8 max-w-xl" style={{ color: "var(--text-secondary)" }}>
          Внешние сервисы, из которых мы тянем данные для формирования таблиц.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {TILES.map((tile) => (
            <button
              key={tile.key}
              type="button"
              onClick={() => setOpenService(tile.key)}
              className="group text-left card p-5 transition-colors flex flex-col gap-3.5 hover:bg-[var(--bg-hover)]"
            >
              <span
                className="inline-flex items-center justify-center w-11 h-11 rounded-xl transition-colors"
                style={{ background: "var(--accent-soft)", color: "var(--text-accent)" }}
              >
                <tile.Icon size={20} />
              </span>
              <span className="text-base font-semibold" style={{ color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
                {tile.title}
              </span>
              <span className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
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
