"use client";

/**
 * Блок 5 — Платёжный календарь.
 *
 * Три версии прогноза (Часть 2, §5): договорной, статистический, предиктивный.
 * Каждая отвечает на «когда ждать денег», но опирается на разное — и блок прямо
 * показывает, на что именно, включая долю строк, где личного прогноза не хватило
 * и пришлось откатиться на общую статистику.
 *
 * Отдельно — «план против факта» за прошлые месяцы: без него календарь выглядел
 * бы точнее, чем он есть.
 */
import { useCallback, useEffect, useMemo, useState } from "react";

import { BbcApiError, fetchCalendar } from "../api";
import { money, moneyShort, monthLabel, percent, plural } from "../format";
import type { BbcCalendar, BbcCalendarMethod, BbcExpectation } from "../types";
import { SectionCard } from "./shared";

const BASIS_LABEL: Record<BbcExpectation["basis"], string> = {
  personal: "по истории клиента",
  global: "по общей статистике",
  plan: "по договору",
};

export function CalendarBlock() {
  const [method, setMethod] = useState<BbcCalendarMethod>("predictive");
  const [calendar, setCalendar] = useState<BbcCalendar | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (next: BbcCalendarMethod) => {
    setLoading(true);
    try {
      setCalendar(await fetchCalendar(next));
      setError(null);
    } catch (err) {
      setError(err instanceof BbcApiError ? err.message : "Не удалось построить календарь");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(method);
  }, [load, method]);

  if (error) {
    return (
      <SectionCard title="Платёжный календарь" subtitle="Не удалось загрузить">
        <p className="text-xs" style={{ color: "var(--accent-rose)" }}>
          {error}
        </p>
      </SectionCard>
    );
  }

  if (!calendar) {
    return (
      <SectionCard title="Платёжный календарь" subtitle="Считаем ожидаемые поступления…">
        <p className="mono-meta">Загрузка…</p>
      </SectionCard>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionCard
        title="Когда ждать денег"
        subtitle={calendar.hint}
        action={
          <div className="flex gap-1.5 flex-wrap">
            {calendar.methods.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setMethod(item.key)}
                disabled={loading}
                className="text-xs px-2.5 py-1.5 rounded-lg"
                style={{
                  background: method === item.key ? "var(--accent-soft)" : "var(--bg-active)",
                  border: `1px solid ${method === item.key ? "var(--accent-line)" : "transparent"}`,
                  color: method === item.key ? "var(--text-accent)" : "var(--text-secondary)",
                  transition: "background var(--dur-fast)",
                }}
                title={item.hint}
              >
                {item.title}
              </button>
            ))}
          </div>
        }
      >
        <div className="grid gap-2.5 grid-cols-2 sm:grid-cols-4">
          <Tile label="Ожидаем всего" value={moneyShort(calendar.total)} />
          <Tile
            label="Просрочено"
            value={moneyShort(calendar.overdue_total)}
            hint={`${calendar.overdue_count} ${plural(calendar.overdue_count, "строка", "строки", "строк")}`}
            tone="var(--accent-rose)"
          />
          <Tile
            label="Медианный лаг"
            value={`${calendar.stats.median} дн`}
            hint={`по ${calendar.stats.sample} оплатам`}
          />
          <Tile
            label="Долгий хвост (p80)"
            value={`${calendar.stats.p80} дн`}
            hint={`худший случай ${calendar.stats.worst} дн`}
          />
        </div>

        {method === "predictive" ? (
          <p className="text-xs mt-3" style={{ color: "var(--text-secondary)" }}>
            Личный прогноз построен для{" "}
            <strong style={{ color: "var(--text-primary)" }}>
              {calendar.personal_rows} {plural(calendar.personal_rows, "строки", "строк", "строк")}
            </strong>{" "}
            — столько приходится на {calendar.clients_with_history}{" "}
            {plural(calendar.clients_with_history, "клиента", "клиентов", "клиентов")} с историей от
            трёх оплат. Для остальных взята общая статистика: по одной-двум оплатам личный характер
            от случайности не отличить.
          </p>
        ) : null}
      </SectionCard>

      <UpcomingCard calendar={calendar} />
      <OverdueCard calendar={calendar} />
      <AccuracyCard calendar={calendar} />
    </div>
  );
}

function UpcomingCard({ calendar }: { calendar: BbcCalendar }) {
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = useMemo(
    () =>
      Object.entries(calendar.by_day)
        .filter(([day]) => day >= today)
        .slice(0, 14),
    [calendar, today],
  );

  const max = Math.max(...upcoming.map(([, item]) => item.amount), 1);

  return (
    <SectionCard title="Ближайшие поступления" subtitle="По дням, начиная с сегодняшнего.">
      {upcoming.length ? (
        <div className="flex flex-col gap-2.5">
          {upcoming.map(([day, item], index) => (
            <div key={day}>
              <div className="flex items-baseline justify-between gap-3 mb-1">
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  {new Date(day).toLocaleDateString("ru-RU", {
                    day: "2-digit",
                    month: "short",
                    weekday: "short",
                  })}
                </span>
                <span className="text-xs bbc-num" style={{ color: "var(--text-primary)" }}>
                  {money(item.amount)}
                  <span style={{ color: "var(--text-muted)" }}> · {item.count}</span>
                </span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-active)" }}>
                <div
                  className="h-full rounded-full bbc-grow"
                  style={{
                    width: `${(item.amount / max) * 100}%`,
                    background: "var(--accent-emerald)",
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
          Впереди ожидаемых поступлений нет — всё либо получено, либо просрочено.
        </p>
      )}
    </SectionCard>
  );
}

function OverdueCard({ calendar }: { calendar: BbcCalendar }) {
  const overdue = useMemo(
    () =>
      calendar.expectations
        .filter((item) => item.days_overdue > 0)
        .sort((a, b) => b.days_overdue - a.days_overdue)
        .slice(0, 20),
    [calendar],
  );

  if (!overdue.length) {
    return (
      <SectionCard title="Просрочено" subtitle="Всё ожидаемое пришло вовремя.">
        <p className="text-xs" style={{ color: "var(--accent-emerald)" }}>
          Просроченных ожиданий нет.
        </p>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title="Просрочено"
      subtitle="Деньги ждали раньше, чем сегодня. Сверху — самые давние."
    >
      <div className="overflow-x-auto">
        <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["№", "Клиент", "Отдел", "Ждали", "Просрочка", "Сумма", "Основание"].map((header) => (
                <th
                  key={header}
                  className="text-left font-medium px-2 py-1.5 whitespace-nowrap"
                  style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border-subtle)" }}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {overdue.map((item, index) => (
              <tr
                key={item.row_index}
                className="animate-fade-in"
                style={{
                  animationDuration: "var(--dur-fast)",
                  animationDelay: `calc(${Math.min(index, 15)} * var(--dur-stagger) / 2)`,
                  animationFillMode: "backwards",
                }}
              >
                <td className="px-2 py-1.5 mono-meta">{item.row_index}</td>
                <td
                  className="px-2 py-1.5 max-w-[220px] truncate"
                  style={{ color: "var(--text-primary)" }}
                  title={item.client}
                >
                  {item.client}
                </td>
                <td className="px-2 py-1.5" style={{ color: "var(--text-secondary)" }}>
                  {item.departments.join(", ") || "—"}
                </td>
                <td className="px-2 py-1.5 mono-meta whitespace-nowrap">
                  {new Date(item.expected_at).toLocaleDateString("ru-RU")}
                </td>
                <td
                  className="px-2 py-1.5 bbc-num whitespace-nowrap"
                  style={{ color: item.days_overdue > 30 ? "var(--accent-rose)" : "var(--accent-amber)" }}
                >
                  {item.days_overdue} {plural(item.days_overdue, "день", "дня", "дней")}
                </td>
                <td className="px-2 py-1.5 text-right bbc-num" style={{ color: "var(--text-primary)" }}>
                  {money(item.amount)}
                </td>
                <td className="px-2 py-1.5" style={{ color: "var(--text-muted)" }}>
                  {BASIS_LABEL[item.basis]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {calendar.overdue_count > overdue.length ? (
        <p className="mono-meta mt-2">
          показано {overdue.length} из {calendar.overdue_count}
        </p>
      ) : null}
    </SectionCard>
  );
}

function AccuracyCard({ calendar }: { calendar: BbcCalendar }) {
  if (!calendar.accuracy.length) {
    return null;
  }
  const hitRate = calendar.accuracy[0]?.hit_rate ?? 0;
  const max = Math.max(
    ...calendar.accuracy.flatMap((item) => [item.predicted, item.actual]),
    1,
  );

  return (
    <SectionCard
      title="План против факта"
      subtitle="Насколько прогноз сбывался в прошлом — иначе календарь выглядел бы точнее, чем он есть."
    >
      <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>
        Прогноз попадал в нужный месяц в{" "}
        <strong
          style={{ color: hitRate > 0.7 ? "var(--accent-emerald)" : "var(--accent-amber)" }}
        >
          {percent(hitRate)}
        </strong>{" "}
        случаев.
      </p>
      <div className="flex flex-col gap-3">
        {calendar.accuracy.map((item, index) => (
          <div key={item.month}>
            <div className="flex items-baseline justify-between gap-3 mb-1">
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {monthLabel(item.month)}
              </span>
              <span className="text-xs bbc-num" style={{ color: "var(--text-primary)" }}>
                прогноз {moneyShort(item.predicted)} · факт {moneyShort(item.actual)}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <Bar value={item.predicted} max={max} colour="var(--accent)" index={index} />
              <Bar value={item.actual} max={max} colour="var(--accent-emerald)" index={index} />
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 mt-3">
        <Legend colour="var(--accent)" label="прогноз" />
        <Legend colour="var(--accent-emerald)" label="факт" />
      </div>
    </SectionCard>
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
          width: `${(value / max) * 100}%`,
          background: colour,
          transformOrigin: "left",
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
