"use client";

/**
 * Блок 2 — Отчёты.
 *
 * ДДС → ОПиУ → Баланс run as one ribbon, months as columns, exactly as spec §2
 * describes ("один лист, сверху вниз"). Keeping them stacked rather than tabbed
 * is the point: the same month can be read across all three reports without
 * switching.
 *
 * ДДС считается по журналу: дата и суммы там заполнены полностью, поэтому
 * помесячные обороты точные. Категория есть лишь у трети операций, так что
 * разбивка по статьям идёт отдельно и несёт своё покрытие.
 */
import { useEffect, useMemo, useState } from "react";

import { BbcApiError, exportMsfo, fetchJournal } from "../api";
import { CycleColumns } from "../charts";
import { money, monthLabel, percent } from "../format";
import type { BbcJournalPayload, BbcMode, BbcMsfoExport, BbcRow } from "../types";
import {
  byMonthCycle,
  documentaryCounterpart,
  isActDateMode,
  recognizedTotal,
  sumBy,
  wipTotal,
} from "../use-dataset";
import { SectionCard } from "./shared";

type ReportRow = {
  label: string;
  values: Record<string, number>;
  tone?: "primary" | "muted" | "total";
  note?: string;
};

export function ReportsBlock({ rows, mode }: { rows: BbcRow[]; mode: BbcMode }) {
  const [showCycles, setShowCycles] = useState(true);

  const monthly = useMemo(() => byMonthCycle(rows, mode), [rows, mode]);
  const months = monthly.map((item) => item.month);

  const recognized = recognizedTotal(rows, mode);
  const wip = wipTotal(rows, mode);

  /* ── ОПиУ: revenue by department, then the WIP bucket ── */
  const pnlRows: ReportRow[] = useMemo(() => {
    const departments = ["ОБО", "НО", "ЮО", "HR", "ФО"];
    const result: ReportRow[] = departments
      .map((code) => ({
        label: `Выручка · ${code}`,
        values: Object.fromEntries(
          monthly.map((month) => [
            month.month,
            rows
              .filter((row) => row.departments.includes(code))
              .reduce(
                (sum, row) =>
                  sum +
                  (row.recognition[mode]?.alloc ?? [])
                    .filter(
                      ([year, monthNumber]) =>
                        `${year}-${String(monthNumber).padStart(2, "0")}` === month.month,
                    )
                    .reduce((inner, entry) => inner + entry[3], 0),
                0,
              ),
          ]),
        ),
      }))
      .filter((row) => Object.values(row.values).some(Boolean));

    result.push({
      label: "Итого признано",
      values: Object.fromEntries(monthly.map((month) => [month.month, month.total])),
      tone: "total",
    });

    if (wip) {
      result.push({
        label: "На исполнении (WIP)",
        values: Object.fromEntries(months.map((month) => [month, 0])),
        tone: "muted",
        note: `${money(wip)} — заработано, но период услуги не задан или работа не закрыта`,
      });
    }
    return result;
  }, [rows, mode, monthly, months, wip]);

  /* ── Balance: the two legs of the bridge become assets and liabilities ── */
  const balanceRows: ReportRow[] = useMemo(() => {
    const perMonth = (predicate: (row: BbcRow) => boolean, pick: (row: BbcRow) => number | null) =>
      Object.fromEntries(
        months.map((month) => {
          const monthNumber = Number(month.split("-")[1]);
          return [
            month,
            sumBy(
              rows.filter((row) => row.month === monthNumber && predicate(row)),
              pick,
            ),
          ];
        }),
      );

    return [
      {
        label: "Актив · дебиторская задолженность",
        values: perMonth(
          (row) => row.avr_signed === true && row.paid !== true,
          (row) => row.avr_amount ?? row.contract_amount,
        ),
      },
      {
        label: "Обязательство · доходы будущих периодов",
        values: perMonth((row) => row.paid === true && row.avr_signed !== true, (row) => row.paid_amount),
      },
      {
        label: "Сальдо на конец (по строкам)",
        values: perMonth(() => true, (row) => row.saldo_end),
        tone: "total",
      },
    ];
  }, [rows, months]);

  const gap = useMemo(() => {
    if (isActDateMode(mode)) return null;
    const v2mode: BbcMode = mode.startsWith("v2:") ? mode : (`v2:${mode.slice("v1:period:".length)}` as BbcMode);
    const v1mode = documentaryCounterpart(v2mode);
    const earned = byMonthCycle(rows, v2mode);
    const documented = byMonthCycle(rows, v1mode);

    return earned.map((item) => {
      const closed = documented.find((entry) => entry.month === item.month)?.total ?? 0;
      return {
        month: item.month,
        earned: item.total,
        documented: closed,
        share: item.total ? closed / item.total : 0,
      };
    });
  }, [rows, mode]);

  return (
    <div className="flex flex-col gap-4">
      <SectionCard
        title="Отчёты одной лентой"
        subtitle="ДДС → ОПиУ → Баланс, месяцы колонками — как в §2 спецификации, чтобы строки сопоставлялись без переключения."
        action={
          <button
            type="button"
            className="btn-ghost text-xs px-2.5 py-1"
            onClick={() => setShowCycles((value) => !value)}
          >
            {showCycles ? "Скрыть циклы" : "Показать циклы"}
          </button>
        }
      >
        <CycleColumns data={monthly} showCycles={showCycles} />
        {showCycles ? (
          <div className="flex items-center gap-4 mt-3">
            <Legend colour="var(--accent-soft)" border="var(--accent-line)" label="Цикл 1 (01–15)" />
            <Legend colour="var(--accent)" label="Цикл 2 (16–конец)" />
          </div>
        ) : null}
      </SectionCard>

      <MsfoExportCard />

      {/* ── ДДС ── */}
      <CashflowSection />

      {/* ── ОПиУ ── */}
      <SectionCard
        title="ОПиУ — отчёт о прибылях и убытках"
        subtitle="Метод начисления, два цикла внутри месяца. Итог календарного месяца = цикл 1 + цикл 2."
      >
        <ReportTable months={months} rows={pnlRows} />
        <p className="mono-meta mt-3">
          признано {money(recognized)}
          {wip ? ` · в «на исполнении» ${money(wip)}` : ""}
        </p>
      </SectionCard>

      {/* ── Баланс ── */}
      <SectionCard
        title="Баланс"
        subtitle="Расхождения между оплатой и признанием оседают здесь: дебиторка и доходы будущих периодов."
      >
        <ReportTable months={months} rows={balanceRows} />
        <div
          className="card-inner p-3 text-xs mt-3"
          style={{ color: "var(--text-secondary)" }}
        >
          <p className="mb-1" style={{ color: "var(--accent-amber)" }}>
            Сверка «Активы = Обязательства + Капитал» пока неполная
          </p>
          Капитал и кредиторская задолженность считаются из журнала и табеля; ни то, ни другое
          ещё не заполнено. Показываем то, что считается честно, вместо подогнанного нуля.
        </div>
      </SectionCard>

      {/* ── Разрыв ── */}
      {gap ? (
        <SectionCard
          title="Разрыв: заработано против закрытого документами"
          subtitle="Обе стороны на одной временной базе, поэтому доля «закрыто документами» осмысленна."
        >
          <div className="flex flex-col gap-2.5">
            {gap.map((item, index) => (
              <div key={item.month}>
                <div className="flex items-baseline justify-between gap-3 mb-1">
                  <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    {monthLabel(item.month)}
                  </span>
                  <span className="text-xs bbc-num" style={{ color: "var(--text-primary)" }}>
                    {money(item.documented)} из {money(item.earned)}
                    <span
                      className="ml-2"
                      style={{ color: item.share > 0.5 ? "var(--accent-emerald)" : "var(--accent-amber)" }}
                    >
                      {percent(item.share)}
                    </span>
                  </span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-active)" }}>
                  <div
                    className="h-full rounded-full bbc-grow"
                    style={{
                      width: `${Math.min(100, item.share * 100)}%`,
                      background: "var(--accent-emerald)",
                      transformOrigin: "left",
                      animationDelay: `calc(${index} * var(--dur-stagger))`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs mt-3" style={{ color: "var(--text-muted)" }}>
            Доля падает к текущему месяцу — это нормально: акты за свежие периоды ещё не подписаны.
          </p>
        </SectionCard>
      ) : (
        <SectionCard title="Разрыв" subtitle="Недоступен в текущем режиме">
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            В режиме «по дате акта» заработанное и закрытое лежат на разных календарях, поэтому
            их отношение по месяцам считать нельзя. Переключите аллокацию на «по периоду услуги».
          </p>
        </SectionCard>
      )}
    </div>
  );
}

/**
 * ДДС на данных журнала.
 *
 * Дата и суммы в журнале заполнены полностью, поэтому помесячные поступления и
 * списания — точные. А вот категория есть лишь у трети операций, так что разбивка
 * по статьям идёт отдельным блоком со своим покрытием: показать её как полную
 * значило бы соврать.
 */
function CashflowSection() {
  const [byMonth, setByMonth] = useState<BbcJournalPayload | null>(null);
  const [byCategory, setByCategory] = useState<BbcJournalPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [months, categories] = await Promise.all([
          fetchJournal("month", "net"),
          fetchJournal("category", "outflow"),
        ]);
        if (cancelled) return;
        setByMonth(months);
        setByCategory(categories);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof BbcApiError ? err.message : "Не удалось загрузить журнал");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <SectionCard title="ДДС — движение денежных средств" subtitle="Кассовый метод, календарный месяц.">
        <p className="text-xs" style={{ color: "var(--accent-rose)" }}>
          {error}
        </p>
      </SectionCard>
    );
  }

  if (!byMonth || !byCategory) {
    return (
      <SectionCard title="ДДС — движение денежных средств" subtitle="Считаем обороты по журналу…">
        <p className="mono-meta">Загрузка…</p>
      </SectionCard>
    );
  }

  const items = [...byMonth.summary.items].sort((a, b) => a.key.localeCompare(b.key));
  const cashMonths = items.map((item) => item.key);

  // Сальдо накапливается: конец месяца — это начало следующего (§3).
  let running = 0;
  const opening: Record<string, number> = {};
  const closing: Record<string, number> = {};
  for (const item of items) {
    opening[item.key] = running;
    running += item.value;
    closing[item.key] = running;
  }

  return (
    <>
      <SectionCard
        title="ДДС — движение денежных средств"
        subtitle="Кассовый метод по журналу операций. От переключателей режима не зависит: деньги есть деньги."
      >
        <ReportTable
          months={cashMonths}
          rows={[
            { label: "Сальдо на начало", values: opening, tone: "muted" },
            {
              label: "Поступления",
              values: Object.fromEntries(items.map((item) => [item.key, item.inflow])),
            },
            {
              label: "Списания",
              values: Object.fromEntries(items.map((item) => [item.key, -item.outflow])),
            },
            {
              label: "Чистый поток",
              values: Object.fromEntries(items.map((item) => [item.key, item.value])),
            },
            { label: "Сальдо на конец", values: closing, tone: "total" },
          ]}
        />
        <p className="mono-meta mt-3">
          {byMonth.coverage.rows.toLocaleString("ru-RU")} операций · приход{" "}
          {money(byMonth.coverage.inflow)} · расход {money(byMonth.coverage.outflow)}
        </p>
      </SectionCard>

      <SectionCard
        title="ДДС по статьям"
        subtitle="Разбивка списаний по категориям журнала."
      >
        <div
          className="card-inner p-3 text-xs mb-3"
          style={{ color: "var(--text-secondary)" }}
        >
          <p style={{ color: "var(--accent-amber)" }}>
            Категория заполнена у {percent(byCategory.coverage.with_category)} операций
          </p>
          В разбивку не попали {byCategory.summary.missing_rows} операций на{" "}
          {money(byCategory.summary.missing_value)} ₸. Итоги месяцев выше от этого не страдают —
          они считаются по суммам, а не по статьям.
        </div>
        {byCategory.summary.items.length ? (
          <div className="flex flex-col gap-2.5">
            {byCategory.summary.items.map((item, index) => (
              <div key={item.key}>
                <div className="flex items-baseline justify-between gap-3 mb-1">
                  <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    {item.key}
                    <span className="mono-meta ml-2">{item.count} оп.</span>
                  </span>
                  <span className="text-xs bbc-num" style={{ color: "var(--text-primary)" }}>
                    {money(item.value)}
                  </span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-active)" }}>
                  <div
                    className="h-full rounded-full bbc-grow"
                    style={{
                      width: `${
                        (item.value /
                          Math.max(...byCategory.summary.items.map((entry) => entry.value), 1)) * 100
                      }%`,
                      background: "var(--accent-rose)",
                      transformOrigin: "left",
                      animationDelay: `calc(${index} * var(--dur-stagger))`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Категории пока не проставлены.
          </p>
        )}
      </SectionCard>
    </>
  );
}

/**
 * Выгрузка по МСФО.
 *
 * Одна таблица, лист на каждую логику признания плюс лист сверки; строки на
 * листах вариантов совпадают построчно, поэтому их можно сравнивать глазами.
 *
 * Сервис-аккаунт не может создать таблицу сам — у него нет квоты в Google Drive.
 * Поэтому таблицу-приёмник создаёт человек и делится доступом; если она не
 * настроена, бэкенд отвечает инструкцией, и мы показываем её как есть.
 */
function MsfoExportCard() {
  const [result, setResult] = useState<BbcMsfoExport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      setResult(await exportMsfo());
    } catch (err) {
      setError(err instanceof BbcApiError ? err.message : "Не удалось выгрузить");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SectionCard
      title="Выгрузка по МСФО"
      subtitle="Отдельная Google-таблица: лист на каждую логику признания плюс сверка. Структура строк одинаковая."
      action={
        <button type="button" className="btn-primary text-xs px-3 py-1.5" onClick={run} disabled={busy}>
          {busy ? "Формируем…" : "Выгрузить по МСФО"}
        </button>
      }
    >
      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
        Основной лист — «по периодам»: по IFRS 15 выручка по абонентскому обслуживанию признаётся
        по мере оказания услуги, а не по подписанию акта. Документарный лист даётся рядом для
        сопоставления с бухгалтерией.
      </p>

      {error ? (
        <div
          className="card-inner p-3 text-xs mt-3"
          style={{ color: "var(--text-secondary)", borderColor: "var(--outflow-border)" }}
          role="alert"
        >
          <p className="mb-1" style={{ color: "var(--accent-amber)" }}>
            Выгрузка не настроена
          </p>
          {error}
        </div>
      ) : null}

      {result ? (
        <div className="card-inner p-3 mt-3 animate-fade-in" style={{ animationDuration: "var(--dur-base)" }}>
          <p className="text-xs mb-2" style={{ color: "var(--accent-emerald)" }}>
            Готово · {result.rows} строк · листы: {result.sheets.join(", ")}
          </p>
          <a
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost text-xs px-3 py-1.5 inline-flex"
          >
            Открыть таблицу
          </a>
        </div>
      ) : null}
    </SectionCard>
  );
}

function Legend({ colour, border, label }: { colour: string; border?: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
      <span
        aria-hidden="true"
        style={{
          width: 10,
          height: 10,
          borderRadius: 3,
          background: colour,
          border: border ? `1px solid ${border}` : undefined,
        }}
      />
      {label}
    </span>
  );
}

function ReportTable({ months, rows }: { months: string[]; rows: ReportRow[] }) {
  if (!months.length) {
    return (
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        Нет месяцев в текущем срезе.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th
              className="text-left font-medium px-2 py-1.5 sticky left-0 whitespace-nowrap"
              style={{
                color: "var(--text-muted)",
                background: "var(--bg-surface)",
                borderBottom: "1px solid var(--border-subtle)",
              }}
            >
              Статья
            </th>
            {months.map((month) => (
              <th
                key={month}
                className="text-right font-medium px-2 py-1.5 whitespace-nowrap"
                style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border-subtle)" }}
              >
                {monthLabel(month)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td
                className="px-2 py-1.5 sticky left-0 whitespace-nowrap"
                style={{
                  color: row.tone === "total" ? "var(--text-primary)" : "var(--text-secondary)",
                  fontWeight: row.tone === "total" ? 600 : 400,
                  background: "var(--bg-surface)",
                  borderTop: row.tone === "total" ? "1px solid var(--border-base)" : undefined,
                }}
                title={row.note}
              >
                {row.label}
                {row.note ? <span className="mono-meta block">{row.note}</span> : null}
              </td>
              {months.map((month) => (
                <td
                  key={month}
                  className="px-2 py-1.5 text-right bbc-num whitespace-nowrap"
                  style={{
                    color: row.tone === "muted" ? "var(--text-muted)" : "var(--text-primary)",
                    fontWeight: row.tone === "total" ? 600 : 400,
                    borderTop: row.tone === "total" ? "1px solid var(--border-base)" : undefined,
                  }}
                >
                  {row.values[month] ? money(row.values[month]) : "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
