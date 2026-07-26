"use client";

/**
 * Блок 1 — Дебиторка.
 *
 * The block used every day: what is owed, for how long, and what to do next.
 * The bridge is deliberately not a funnel — payments outnumber signed acts in
 * this data, so the gap forks two ways: receivables (act, no money) and
 * prepayments (money, no act). Those two legs are exactly what the balance sheet
 * is built from.
 */
import { useMemo, useState } from "react";

import { Bridge, Heatmap, type BridgeStage } from "../charts";
import { dateLabel, money, moneyShort, percent, plural } from "../format";
import type { BbcMode, BbcRow } from "../types";
import { groupBy, sumBy } from "../use-dataset";
import { KpiStrip, RowTable, SectionCard } from "./shared";

const DAY = 86_400_000;

/** Buckets used for ageing, in days since the invoice date. */
const AGE_BUCKETS = [
  { key: "0-15", label: "до 15 дней", from: 0, to: 15, tone: "emerald" as const },
  { key: "16-30", label: "16–30 дней", from: 16, to: 30, tone: "accent" as const },
  { key: "31-60", label: "31–60 дней", from: 31, to: 60, tone: "amber" as const },
  { key: "60+", label: "больше 60 дней", from: 61, to: Infinity, tone: "rose" as const },
];

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return null;
  return Math.floor((Date.now() - time) / DAY);
}

/** Act signed but not paid — the receivable. */
function isReceivable(row: BbcRow): boolean {
  return row.avr_signed === true && row.paid !== true;
}

/** Paid before the act exists — a prepayment, i.e. deferred revenue. */
function isPrepayment(row: BbcRow): boolean {
  return row.paid === true && row.avr_signed !== true;
}

export function ReceivablesBlock({
  rows,
  mode,
  onDrill,
}: {
  rows: BbcRow[];
  mode: BbcMode;
  onDrill?: (rows: BbcRow[], title: string) => void;
}) {
  const [focus, setFocus] = useState<{ title: string; rows: BbcRow[] } | null>(null);

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
      collection: contracted ? paid / contracted : 0,
    };
  }, [rows]);

  /** Rows that need an invoice issued, soonest period first. */
  const toInvoice = useMemo(
    () =>
      stats.notInvoiced
        // Строка без клиента — это дефект данных, а не задача: ей место
        // в блоке «Предупреждения», а не в списке дел.
        .filter((row) => row.period_start && row.client)
        .sort((a, b) => (a.period_start ?? "").localeCompare(b.period_start ?? ""))
        .slice(0, 12),
    [stats.notInvoiced],
  );

  /** Overdue: invoiced long ago, still unpaid. */
  const overdue = useMemo(
    () =>
      rows
        .filter((row) => row.invoiced === true && row.paid !== true && row.invoice_date)
        .map((row) => ({ row, age: daysSince(row.invoice_date) ?? 0 }))
        .filter((item) => item.age > 0)
        .sort((a, b) => b.age - a.age),
    [rows],
  );

  const ageing = useMemo(() => {
    return AGE_BUCKETS.map((bucket) => {
      const inBucket = overdue.filter((item) => item.age >= bucket.from && item.age <= bucket.to);
      return {
        ...bucket,
        count: inBucket.length,
        amount: sumBy(
          inBucket.map((item) => item.row),
          (row) => row.contract_amount,
        ),
        rows: inBucket.map((item) => item.row),
      };
    });
  }, [overdue]);

  const ageingTotal = useMemo(
    () => ageing.reduce((sum, bucket) => sum + bucket.amount, 0),
    [ageing],
  );

  const stages: BridgeStage[] = [
    {
      key: "contracted",
      label: "Договоров на",
      value: stats.contracted,
      leak: {
        label: `счёт не выставлен · ${stats.notInvoiced.length} ${plural(stats.notInvoiced.length, "строка", "строки", "строк")}`,
        value: stats.notInvoicedAmount,
        tone: "amber",
        onClick: () => setFocus({ title: "Счёт не выставлен", rows: stats.notInvoiced }),
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
        onClick: () => setFocus({ title: "Дебиторская задолженность", rows: stats.receivables }),
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
        onClick: () => setFocus({ title: "Доходы будущих периодов (авансы)", rows: stats.prepayments }),
      },
    },
  ];

  /** Client × month view of the act-minus-payment difference. */
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

    const months = [...new Set(withDiff.map((row) => row.month).filter(Boolean))]
      .sort((a, b) => (a ?? 0) - (b ?? 0))
      .map((month) => `2026-${String(month).padStart(2, "0")}`);

    return { clients: top, months };
  }, [rows]);

  return (
    <div className="flex flex-col gap-4">
      <KpiStrip
        items={[
          { label: "Договоров", value: stats.contracted },
          { label: "Выставлено", value: stats.invoicedAmount },
          { label: "Получено", value: stats.paid },
          { label: "Дебиторка", value: stats.receivableAmount, tone: "rose" },
          { label: "Авансы", value: stats.prepaymentAmount, tone: "emerald" },
          {
            label: "Собираемость",
            value: stats.collection,
            format: "percent",
            tone: stats.collection > 0.6 ? "emerald" : "amber",
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
          subtitle="Сколько времени прошло с выставления счёта до сегодня. Полоска — доля корзины в общей просрочке."
        >
          {overdue.length ? (
            <div className="flex flex-col gap-2.5">
              {ageing.map((bucket, index) => (
                <button
                  key={bucket.key}
                  type="button"
                  className="w-full text-left"
                  onClick={() => setFocus({ title: `Не оплачено ${bucket.label}`, rows: bucket.rows })}
                  disabled={!bucket.count}
                >
                  <div className="flex items-baseline justify-between gap-3 mb-1">
                    <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      {bucket.label}
                    </span>
                    <span className="text-xs bbc-num" style={{ color: "var(--text-primary)" }}>
                      {money(bucket.amount)}
                      <span style={{ color: "var(--text-muted)" }}>
                        {" "}· {ageingTotal ? percent(bucket.amount / ageingTotal) : "—"} ·{" "}
                        {bucket.count} {plural(bucket.count, "счёт", "счёта", "счетов")}
                      </span>
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-active)" }}>
                    <div
                      className="h-full rounded-full bbc-grow"
                      style={{
                        // Доля от всей просрочки: полоска во всю строку означала бы
                        // «вся просрочка в этой корзине», а не «эта корзина крупнейшая».
                        width: `${ageingTotal ? (bucket.amount / ageingTotal) * 100 : 0}%`,
                        background: `var(--accent-${bucket.tone === "accent" ? "" : bucket.tone})`.replace(
                          "var(--accent-)",
                          "var(--accent)",
                        ),
                        transformOrigin: "left",
                        animationDelay: `calc(${index} * var(--dur-stagger))`,
                      }}
                    />
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Нет счетов, ожидающих оплаты.
            </p>
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="Что сделать"
        subtitle="Подсказки, собранные из строк: где не выставлен счёт и где оплата задерживается дольше всего."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="eyebrow mb-2">Выставить счёт</p>
            {toInvoice.length ? (
              <ul className="flex flex-col gap-1.5">
                {toInvoice.map((row, index) => (
                  <li
                    key={`${row.index}`}
                    className="row-item px-2.5 py-1.5 flex items-center justify-between gap-2 animate-fade-in"
                    style={{
                      animationDuration: "var(--dur-base)",
                      animationDelay: `calc(${index} * var(--dur-stagger))`,
                      animationFillMode: "backwards",
                    }}
                  >
                    <span className="text-xs truncate" style={{ color: "var(--text-primary)" }}>
                      {row.client || "—"}
                    </span>
                    <span className="mono-meta shrink-0">
                      с {dateLabel(row.period_start)} · {moneyShort(row.contract_amount)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Все счета выставлены.
              </p>
            )}
          </div>

          <div>
            <p className="eyebrow mb-2">Дольше всего без оплаты</p>
            {overdue.length ? (
              <ul className="flex flex-col gap-1.5">
                {overdue.slice(0, 12).map((item, index) => (
                  <li
                    key={item.row.index}
                    className="row-item px-2.5 py-1.5 flex items-center justify-between gap-2 animate-fade-in"
                    style={{
                      animationDuration: "var(--dur-base)",
                      animationDelay: `calc(${index} * var(--dur-stagger))`,
                      animationFillMode: "backwards",
                    }}
                  >
                    <span className="text-xs truncate" style={{ color: "var(--text-primary)" }}>
                      {item.row.client || "—"}
                    </span>
                    <span className="mono-meta shrink-0" style={{ color: item.age > 60 ? "var(--accent-rose)" : undefined }}>
                      {item.age} {plural(item.age, "день", "дня", "дней")} · {moneyShort(item.row.contract_amount)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Просроченных оплат нет.
              </p>
            )}
          </div>
        </div>
      </SectionCard>

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
              if (entry) setFocus({ title: client, rows: entry.rows });
            }}
          />
        </SectionCard>
      ) : null}

      {focus ? (
        <SectionCard
          title={focus.title}
          subtitle={`${focus.rows.length} ${plural(focus.rows.length, "строка", "строки", "строк")} · ${money(
            sumBy(focus.rows, (row) => row.contract_amount),
          )}`}
          action={
            <button type="button" className="btn-ghost text-xs px-2.5 py-1" onClick={() => setFocus(null)}>
              Закрыть
            </button>
          }
        >
          <RowTable rows={focus.rows} mode={mode} onDrill={onDrill} />
        </SectionCard>
      ) : null}
    </div>
  );
}
