"use client";

/**
 * Блок 6 — Отдел продаж.
 *
 * Собран на таблице «расчет плана ОМиП»: план против факта, ФОТ с разбивкой
 * фикс + бонус по каждому сотруднику (готовая база для KPI и бонусов) и отдача
 * на маркетинговый канал — расход на канал против выручки по полю «Источник»
 * из реестра продаж. Bitrix для этого не нужен.
 */
import { useCallback, useEffect, useState } from "react";

import { BbcApiError, fetchSales } from "../api";
import { money, moneyShort, percent, plural } from "../format";
import { SpecList, type FieldSpec } from "../mobile/card-list";
import type { BbcPayrollLine, BbcSalesReport } from "../types";
import { SectionCard } from "./shared";

/**
 * Колонки ФОТ.
 *
 * План лежит отдельным списком, а дельта считается из плана и факта сразу —
 * поэтому план приходит в колонки контекстом, а не полем строки.
 *
 * Фикс и план бонуса помечены `optional`: сравнивают всегда факт с дельтой,
 * а исходные суммы нужны реже. Дельта не помечена никогда — ради неё в этот
 * список и заходят.
 */
const PAYROLL_COLUMNS: FieldSpec<BbcPayrollLine, BbcPayrollLine[]>[] = [
  {
    key: "name",
    header: "Сотрудник",
    primary: true,
    tone: "var(--text-primary)",
    render: (line) => line.name,
  },
  {
    key: "role",
    header: "Роль",
    secondary: true,
    render: (line) => line.role,
  },
  {
    key: "fixed",
    header: "Фикс",
    align: "right",
    optional: true,
    cellClass: "text-right bbc-num",
    render: (line) => money(line.fixed),
  },
  {
    key: "bonusPlan",
    header: "Бонус план",
    align: "right",
    optional: true,
    cellClass: "text-right bbc-num",
    tone: "var(--text-muted)",
    render: (line, plan) => money(plan.find((item) => item.name === line.name)?.bonus ?? 0),
  },
  {
    key: "bonusFact",
    header: "Бонус факт",
    align: "right",
    cellClass: "text-right bbc-num",
    tone: "var(--text-primary)",
    render: (line) => money(line.bonus),
  },
  {
    key: "bonusDelta",
    header: "Δ бонуса",
    align: "right",
    cellClass: "text-right bbc-num",
    // Цвет здесь зависит от знака, поэтому красит сам render, а не `tone`.
    render: (line, plan) => {
      const delta = line.bonus - (plan.find((item) => item.name === line.name)?.bonus ?? 0);
      return (
        <span style={{ color: delta >= 0 ? "var(--accent-emerald)" : "var(--accent-rose)" }}>
          {delta >= 0 ? "+" : "−"}
          {money(Math.abs(delta))}
        </span>
      );
    },
  },
  {
    key: "total",
    header: "Всего факт",
    align: "right",
    cellClass: "text-right bbc-num",
    tone: "var(--text-primary)",
    render: (line) => money(line.total),
  },
];

export function SalesBlock() {
  const [report, setReport] = useState<BbcSalesReport | null>(null);
  const [tab, setTab] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (worksheet?: string) => {
    setLoading(true);
    try {
      const payload = await fetchSales(worksheet);
      setReport(payload);
      setTab(payload.worksheet || worksheet || payload.tabs.at(-1) || null);
      setError(null);
    } catch (err) {
      setError(err instanceof BbcApiError ? err.message : "Не удалось загрузить отчёт");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <SectionCard title="Отдел продаж" subtitle="Не удалось загрузить">
        <p className="text-xs" style={{ color: "var(--accent-rose)" }}>
          {error}
        </p>
      </SectionCard>
    );
  }

  if (!report) {
    return (
      <SectionCard title="Отдел продаж" subtitle="Читаем таблицу ОМиП…">
        <p className="mono-meta">Загрузка…</p>
      </SectionCard>
    );
  }

  const planTone =
    report.plan_completion >= 1
      ? "var(--accent-emerald)"
      : report.plan_completion >= 0.8
        ? "var(--accent-amber)"
        : "var(--accent-rose)";

  return (
    <div className="flex flex-col gap-4">
      <SectionCard
        title="План и факт отдела"
        subtitle="Источник — лист «Отчет …» таблицы «расчет плана ОМиП»."
        action={
          report.tabs.length > 1 ? (
            <div className="flex gap-1.5 flex-wrap">
              {report.tabs.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => void load(item)}
                  disabled={loading}
                  className="text-xs px-2.5 py-1 rounded-lg"
                  style={{
                    background: tab === item ? "var(--accent-soft)" : "var(--bg-active)",
                    border: `1px solid ${tab === item ? "var(--accent-line)" : "transparent"}`,
                    color: tab === item ? "var(--text-accent)" : "var(--text-secondary)",
                  }}
                >
                  {item}
                </button>
              ))}
            </div>
          ) : null
        }
      >
        <div className="grid gap-2.5 grid-cols-2 sm:grid-cols-4">
          <Tile label="Выручка · план" value={moneyShort(report.revenue_plan)} />
          <Tile label="Выручка · факт" value={moneyShort(report.revenue_fact)} tone={planTone} />
          <Tile label="Выполнение плана" value={percent(report.plan_completion)} tone={planTone} />
          <Tile
            label="Маржа факт"
            value={moneyShort(report.margin_fact)}
            tone={report.margin_fact >= 0 ? "var(--accent-emerald)" : "var(--accent-rose)"}
            hint={`расходы ${moneyShort(report.expense_fact)}`}
          />
        </div>

        {report.per_mop.length ? (
          <div className="mt-4">
            <p className="eyebrow mb-2">Выручка по менеджерам</p>
            <div className="flex flex-col gap-2.5">
              {report.per_mop.map((item, index) => (
                <div key={item.name}>
                  <div className="flex items-baseline justify-between gap-3 mb-1">
                    <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      {item.name}
                    </span>
                    <span className="text-xs bbc-num" style={{ color: "var(--text-primary)" }}>
                      {money(item.revenue)}
                      <span style={{ color: "var(--text-muted)" }}>
                        {" "}
                        · {percent(report.revenue_fact ? item.revenue / report.revenue_fact : 0)}
                      </span>
                    </span>
                  </div>
                  <Bar
                    value={item.revenue}
                    max={Math.max(...report.per_mop.map((entry) => entry.revenue), 1)}
                    colour="var(--accent)"
                    index={index}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard
        title="ФОТ: фикс и бонус"
        subtitle="Готовая база для KPI и премий — план против факта по каждому сотруднику."
      >
        {/* Первые две колонки текстовые, остальные денежные: подпись стоит над
            своим числом, а не у левого края пустого столбца. */}
        <SpecList
          columns={PAYROLL_COLUMNS}
          rows={report.payroll_fact}
          // План живёт в соседнем списке, а дельта считается из обоих — поэтому
          // он и передаётся колонкам как контекст.
          ctx={report.payroll_plan}
          rowKey={(line) => line.name}
          limit={report.payroll_fact.length}
          mobileLimit={report.payroll_fact.length}
        />
      </SectionCard>

      <SectionCard
        title="Отдача на маркетинговый канал"
        subtitle="Расход на канал против выручки по полю «Источник» реестра продаж."
      >
        {report.channels.length ? (
          <div className="flex flex-col gap-3">
            {report.channels.map((channel, index) => (
              <div key={channel.channel} className="row-item p-3">
                <div className="flex items-baseline justify-between gap-3 flex-wrap mb-2">
                  <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                    {channel.channel}
                    <span className="mono-meta ml-2">
                      {channel.deals} {plural(channel.deals, "сделка", "сделки", "сделок")}
                    </span>
                  </span>
                  <span className="text-xs bbc-num" style={{ color: "var(--text-secondary)" }}>
                    расход {money(channel.spend)} · выручка {money(channel.revenue)}
                    {channel.roi !== null ? (
                      <strong
                        className="ml-2"
                        style={{
                          color:
                            channel.roi >= 3
                              ? "var(--accent-emerald)"
                              : channel.roi >= 1
                                ? "var(--accent-amber)"
                                : "var(--accent-rose)",
                        }}
                      >
                        ROI {channel.roi}×
                      </strong>
                    ) : (
                      <span className="ml-2" style={{ color: "var(--text-muted)" }}>
                        без расхода
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <Bar
                    value={channel.spend}
                    max={Math.max(...report.channels.map((item) => Math.max(item.spend, item.revenue)), 1)}
                    colour="var(--accent-rose)"
                    index={index}
                  />
                  <Bar
                    value={channel.revenue}
                    max={Math.max(...report.channels.map((item) => Math.max(item.spend, item.revenue)), 1)}
                    colour="var(--accent-emerald)"
                    index={index}
                  />
                </div>
              </div>
            ))}
            <div className="flex items-center gap-4">
              <Legend colour="var(--accent-rose)" label="расход" />
              <Legend colour="var(--accent-emerald)" label="выручка" />
            </div>
          </div>
        ) : (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            В реестре продаж не проставлен «Источник» — сопоставить расход с выручкой не по чему.
          </p>
        )}
      </SectionCard>

      {report.contractors.length || report.ad_budget.length ? (
        <SectionCard title="Расходы отдела" subtitle="Подрядчики и рекламный бюджет, план против факта.">
          <div className="grid gap-4 md:grid-cols-2">
            <SpendList title="Подрядчики" lines={report.contractors} />
            <SpendList title="Бюджет на рекламу" lines={report.ad_budget} />
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}

function SpendList({
  title,
  lines,
}: {
  title: string;
  lines: BbcSalesReport["contractors"];
}) {
  if (!lines.length) return null;
  return (
    <div>
      <p className="eyebrow mb-2">{title}</p>
      <ul className="flex flex-col gap-1.5">
        {lines.map((line) => (
          <li
            key={line.name}
            className="row-item px-2.5 py-1.5 flex items-center justify-between gap-2"
          >
            <span className="text-xs truncate" style={{ color: "var(--text-primary)" }}>
              {line.name}
              {line.channel ? (
                <span className="mono-meta ml-1.5">{line.channel}</span>
              ) : null}
            </span>
            <span className="text-xs bbc-num shrink-0" style={{ color: "var(--text-secondary)" }}>
              {money(line.fact)}
              {line.plan !== line.fact ? (
                <span style={{ color: "var(--text-muted)" }}> из {money(line.plan)}</span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Bar({
  value,
  max,
  colour,
  index,
}: {
  value: number;
  max: number;
  colour: string;
  index: number;
}) {
  return (
    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-active)" }}>
      <div
        className="h-full rounded-full bbc-grow"
        style={{
          width: `${Math.min(100, (value / max) * 100)}%`,
          background: colour,
          transformOrigin: "left",
          transition: "width var(--dur-tell) var(--ease-out)",
          animationDelay: `calc(${index} * var(--dur-stagger))`,
        }}
      />
    </div>
  );
}

function Legend({ colour, label }: { colour: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
      <span aria-hidden="true" style={{ width: 10, height: 3, borderRadius: 2, background: colour }} />
      {label}
    </span>
  );
}

function Tile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: string;
}) {
  return (
    <div className="card-inner p-3">
      <p className="eyebrow mb-1 truncate">{label}</p>
      <p className="text-base font-semibold bbc-num" style={{ color: tone ?? "var(--text-primary)" }}>
        {value}
      </p>
      {hint ? <p className="mono-meta mt-0.5">{hint}</p> : null}
    </div>
  );
}
