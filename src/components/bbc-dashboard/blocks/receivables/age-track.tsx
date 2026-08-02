"use client";

/**
 * Возраст долга без светофора.
 *
 * Правило проекта: состояние не кодируется цветной точкой, а цвет означает
 * отказ — не «всё хорошо». Поэтому возраст здесь читается числом дней, тем же
 * весом, что и сумма: «94 дня» конкретнее любого кружка и не требует легенды.
 *
 * Полоска показывает, как долг распределён по возрасту. Она графитовая целиком,
 * и единственный цветной сегмент — просрочка больше 60 дней. Нет просрочки —
 * нет цвета: зелёного «всё хорошо» на экране не появляется никогда.
 */
import { money, plural } from "../../format";
import type { BbcRow } from "../../types";
import { rowDebt } from "./debt";

const DAY = 86_400_000;

/** Порог, после которого долг перестаёт быть рабочим и становится проблемой. */
export const OVERDUE_DAYS = 60;

export const AGE_BUCKETS = [
  { key: "0-15", label: "до 15 дней", to: 15 },
  { key: "16-30", label: "16–30 дней", to: 30 },
  { key: "31-60", label: "31–60 дней", to: 60 },
  { key: "60+", label: "больше 60 дней", to: Infinity },
] as const;

export function ageOfRow(row: BbcRow): number | null {
  const iso = row.period_start ?? row.invoice_date;
  if (!iso) return null;
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return null;
  const days = Math.floor((Date.now() - time) / DAY);
  return days > 0 ? days : null;
}

export function bucketOf(days: number): string {
  return AGE_BUCKETS.find((bucket) => days <= bucket.to)!.key;
}

/** Долг по возрастным корзинам. */
export function ageProfile(rows: BbcRow[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const debt = rowDebt(row);
    if (debt <= 0) continue;
    const days = ageOfRow(row);
    if (days === null) continue;
    const key = bucketOf(days);
    totals.set(key, (totals.get(key) ?? 0) + debt);
  }
  return totals;
}

export function AgeLabel({ days }: { days: number | null }) {
  if (days === null) {
    return (
      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
        —
      </span>
    );
  }
  const overdue = days > OVERDUE_DAYS;
  return (
    <span
      className="text-xs bbc-num whitespace-nowrap"
      // Вес, а не цвет: просроченный возраст набран плотнее и основным
      // цветом текста, обычный — приглушён. Цвет остаётся на полоске.
      style={{
        color: overdue ? "var(--text-primary)" : "var(--text-secondary)",
        fontWeight: overdue ? 600 : 400,
      }}
    >
      {days} {plural(days, "день", "дня", "дней")}
    </span>
  );
}

export function AgeTrack({ rows }: { rows: BbcRow[] }) {
  const profile = ageProfile(rows);
  const total = [...profile.values()].reduce((sum, value) => sum + value, 0);

  if (!total) {
    return <div className="bbc-age-track" aria-hidden />;
  }

  return (
    <div
      className="bbc-age-track"
      role="img"
      aria-label={AGE_BUCKETS.filter((bucket) => profile.get(bucket.key))
        .map((bucket) => `${bucket.label}: ${money(profile.get(bucket.key)!)} ₸`)
        .join(", ")}
    >
      {AGE_BUCKETS.map((bucket) => {
        const value = profile.get(bucket.key) ?? 0;
        if (!value) return null;
        return (
          <span
            key={bucket.key}
            className="bbc-age-seg"
            data-overdue={bucket.key === "60+" ? "" : undefined}
            style={{ width: `${(value / total) * 100}%` }}
            title={`${bucket.label}: ${money(value)} ₸`}
          />
        );
      })}
    </div>
  );
}
