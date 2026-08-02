"use client";

/**
 * «Итоги» — аналитика, снятая с главного экрана.
 *
 * Раньше это и был весь блок: шесть плиток, мост сверки, старение и тепловая
 * карта встречали человека вместо ответа на вопрос «кто сколько должен».
 * Содержимое осталось прежним — изменилось место: сюда заходят, когда нужна
 * структура долга, а не конкретный клиент.
 *
 * Одно исправление по существу: старение считалось по сумме договора, то есть
 * показывало не остаток долга. Теперь оно считается по долгу.
 */
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { Bridge, Heatmap, type BridgeStage } from "../../charts";
import { money, moneyShort, percent, plural } from "../../format";
import { CloseIcon } from "../../../icons";
import { useScrollLock } from "../../../use-scroll-lock";
import type { BbcMode, BbcRow } from "../../types";
import { groupBy, sumBy } from "../../use-dataset";
import { KpiStrip, RowTable, SectionCard } from "../shared";
import { AGE_BUCKETS, ageOfRow, bucketOf } from "./age-track";
import { rowDebt } from "./debt";

/** Act signed but not paid — the receivable. */
function isReceivable(row: BbcRow): boolean {
  return row.avr_signed === true && row.paid !== true;
}

/** Paid before the act exists — a prepayment, i.e. deferred revenue. */
function isPrepayment(row: BbcRow): boolean {
  return row.paid === true && row.avr_signed !== true;
}

export function TotalsSheet({
  rows,
  mode,
  focus,
  onFocus,
  onClose,
}: {
  rows: BbcRow[];
  mode: BbcMode;
  focus: { title: string; rows: BbcRow[] } | null;
  onFocus: (focus: { title: string; rows: BbcRow[] } | null) => void;
  onClose: () => void;
}) {
  useScrollLock(true);

  // Портал в body обязателен, а не «так аккуратнее».
  //
  // Блок живёт внутри <main class="bbc-enter">, у которого стоит will-change.
  // Это делает элемент содержащим блоком для position: fixed — и `inset-0`
  // считается уже не от окна. Модалка при этом честно попадает в DOM и даже
  // отвечает на запросы по role="dialog", но на экране её не видно.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const stats = useMemo(() => {
    const contracted = sumBy(rows, (row) => row.contract_amount);
    const invoiced = rows.filter((row) => row.invoiced === true);
    const notInvoiced = rows.filter((row) => row.invoiced !== true && row.contract_amount);
    const receivables = rows.filter(isReceivable);
    const prepayments = rows.filter(isPrepayment);
    const paid = sumBy(rows, (row) => row.paid_amount);

    return {
      contracted,
      invoicedAmount: sumBy(invoiced, (row) => row.contract_amount),
      notInvoiced,
      notInvoicedAmount: sumBy(notInvoiced, (row) => row.contract_amount),
      receivables,
      receivableAmount: sumBy(receivables, (row) => row.avr_amount ?? row.contract_amount),
      prepayments,
      prepaymentAmount: sumBy(prepayments, (row) => row.paid_amount),
      paid,
      debt: rows.reduce((sum, row) => sum + rowDebt(row), 0),
      collection: contracted ? paid / contracted : 0,
    };
  }, [rows]);

  /**
   * Старение долга.
   *
   * Считается по долгу строки и от начала периода: долг возникает, когда период
   * начался, а счёт может быть выставлен позже или не выставлен вовсе.
   */
  const ageing = useMemo(() => {
    const buckets = new Map<string, { amount: number; rows: BbcRow[] }>();
    for (const row of rows) {
      const debt = rowDebt(row);
      if (debt <= 0) continue;
      const days = ageOfRow(row);
      if (days === null) continue;
      const key = bucketOf(days);
      const bucket = buckets.get(key) ?? { amount: 0, rows: [] };
      bucket.amount += debt;
      bucket.rows.push(row);
      buckets.set(key, bucket);
    }
    return AGE_BUCKETS.map((bucket) => ({
      ...bucket,
      amount: buckets.get(bucket.key)?.amount ?? 0,
      rows: buckets.get(bucket.key)?.rows ?? [],
    }));
  }, [rows]);

  const ageingTotal = ageing.reduce((sum, bucket) => sum + bucket.amount, 0);

  const stages: BridgeStage[] = [
    {
      key: "contracted",
      label: "Договоров на",
      value: stats.contracted,
      leak: {
        label: `счёт не выставлен · ${stats.notInvoiced.length} ${plural(stats.notInvoiced.length, "строка", "строки", "строк")}`,
        value: stats.notInvoicedAmount,
        tone: "amber",
        onClick: () => onFocus({ title: "Счёт не выставлен", rows: stats.notInvoiced }),
      },
    },
    {
      key: "invoiced",
      label: "Счета выставлены",
      value: stats.invoicedAmount,
      leak: {
        label: `дебиторка: акт есть, оплаты нет · ${stats.receivables.length}`,
        value: stats.receivableAmount,
        tone: "rose",
        onClick: () => onFocus({ title: "Дебиторская задолженность", rows: stats.receivables }),
      },
    },
    {
      key: "paid",
      label: "Деньги получены",
      value: stats.paid,
      leak: {
        label: `авансы: оплата без акта · ${stats.prepayments.length}`,
        value: stats.prepaymentAmount,
        tone: "emerald",
        onClick: () =>
          onFocus({ title: "Доходы будущих периодов (авансы)", rows: stats.prepayments }),
      },
    },
  ];

  const heat = useMemo(() => {
    const withDiff = rows.filter((row) => row.diff_avr_paid);
    const byClient = groupBy(withDiff, (row) => row.client);
    const top = [...byClient.entries()]
      .map(([client, clientRows]) => ({
        client,
        total: Math.abs(sumBy(clientRows, (row) => row.diff_avr_paid)),
        rows: clientRows,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 12);

    const shown = top.flatMap((item) => item.rows);
    const months = [...new Set(shown.map((row) => row.month).filter(Boolean))]
      .sort((a, b) => (a ?? 0) - (b ?? 0))
      .map((month) => `2026-${String(month).padStart(2, "0")}`);

    return { clients: top, months };
  }, [rows]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center sm:p-6"
      style={{ background: "color-mix(in srgb, var(--bg-base) 82%, transparent)" }}
      role="dialog"
      aria-modal="true"
      aria-label="Итоги по дебиторке"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="card w-full max-w-[1100px] flex flex-col overflow-hidden"
        style={{ maxHeight: "100svh", boxShadow: "var(--shadow-float)" }}
      >
        <div
          className="flex items-center justify-between gap-3 px-4 py-3 shrink-0 pt-safe"
          style={{ borderBottom: "1px solid var(--border-base)" }}
        >
          <div className="min-w-0">
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              Итоги
            </h2>
            <p className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>
              Дебиторка {money(stats.debt)} ₸ · собираемость {percent(stats.collection)}
            </p>
          </div>
          <button type="button" className="btn-ghost text-xs px-2.5 py-1.5" onClick={onClose}>
            <CloseIcon />
            Закрыть
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 flex flex-col gap-4 pb-safe">
          <KpiStrip
            items={[
              { label: "Сумма договоров", value: stats.contracted },
              { label: "Выставлено счетов", value: stats.invoicedAmount },
              { label: "Получено денег", value: stats.paid },
              { label: "Дебиторка", value: stats.debt, tone: "rose" },
              { label: "Авансы", value: stats.prepaymentAmount, tone: "emerald" },
              {
                label: "Собираемость",
                value: stats.collection,
                format: "percent",
                hint: "Доля полученных денег от суммы договоров",
              },
            ]}
          />

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard
              title="Мост сверки"
              subtitle="Оплат больше, чем актов, поэтому расхождение расходится в две стороны. Клик по строке — список договоров."
            >
              <Bridge stages={stages} />
            </SectionCard>

            <SectionCard
              title="Старение долга"
              subtitle="Сколько прошло с начала периода. Полоска — доля корзины в общем долге."
            >
              {ageingTotal ? (
                <div className="flex flex-col gap-2.5">
                  {ageing.map((bucket, index) => (
                    <button
                      key={bucket.key}
                      type="button"
                      className="w-full text-left"
                      onClick={() =>
                        onFocus({ title: `Долг ${bucket.label}`, rows: bucket.rows })
                      }
                      disabled={!bucket.rows.length}
                    >
                      <div className="flex items-baseline justify-between gap-3 mb-1">
                        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                          {bucket.label}
                        </span>
                        <span className="text-xs bbc-num" style={{ color: "var(--text-primary)" }}>
                          {money(bucket.amount)}
                          <span style={{ color: "var(--text-muted)" }}>
                            {" "}
                            · {percent(bucket.amount / ageingTotal)} · {bucket.rows.length}{" "}
                            {plural(bucket.rows.length, "строка", "строки", "строк")}
                          </span>
                        </span>
                      </div>
                      {/* Цвет только на просрочке: остальные корзины графитовые. */}
                      <div
                        className="h-1.5 rounded-full overflow-hidden"
                        style={{ background: "var(--bg-active)" }}
                      >
                        <div
                          className="h-full rounded-full bbc-grow"
                          style={{
                            width: `${(bucket.amount / ageingTotal) * 100}%`,
                            background:
                              bucket.key === "60+"
                                ? "var(--accent-rose)"
                                : "var(--border-strong)",
                            transformOrigin: "left",
                            transition: "width var(--dur-tell) var(--ease-out)",
                            animationDelay: `calc(${index} * var(--dur-stagger))`,
                          }}
                        />
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Долга с определённым возрастом нет.
                </p>
              )}
            </SectionCard>
          </div>

          {heat.clients.length ? (
            <SectionCard
              title="Клиент × месяц"
              subtitle="Разница «акт минус оплата». Синее — нам должны, красное — заплатили вперёд."
            >
              <Heatmap
                rows={heat.clients.map((item) => item.client)}
                columns={heat.months}
                valueAt={(client, column) => {
                  const month = Number(column.split("-")[1]);
                  const entry = heat.clients.find((item) => item.client === client);
                  if (!entry) return 0;
                  return sumBy(
                    entry.rows.filter((row) => row.month === month),
                    (row) => row.diff_avr_paid,
                  );
                }}
                onCell={(client) => {
                  const entry = heat.clients.find((item) => item.client === client);
                  if (entry) onFocus({ title: client, rows: entry.rows });
                }}
              />
            </SectionCard>
          ) : null}

          {focus ? (
            <SectionCard
              title={focus.title}
              subtitle={`${focus.rows.length} ${plural(focus.rows.length, "строка", "строки", "строк")} · ${moneyShort(
                sumBy(focus.rows, (row) => row.contract_amount),
              )}`}
              action={
                <button
                  type="button"
                  className="btn-ghost text-xs px-2.5 py-1"
                  onClick={() => onFocus(null)}
                >
                  Закрыть
                </button>
              }
            >
              <RowTable rows={focus.rows} mode={mode} />
            </SectionCard>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
