/**
 * Number, money and date formatting for the dashboard.
 *
 * Two registers on purpose: KPI tiles show magnitude ("189,0 млн") because a
 * 9-digit string is unreadable at a glance, while tables and tooltips show the
 * exact figure. Everything uses a thin space for thousands and tabular figures,
 * so columns line up and digits do not jitter while a value animates.
 */

const THIN_SPACE = " ";

const MONTHS_SHORT = [
  "янв", "фев", "мар", "апр", "май", "июн",
  "июл", "авг", "сен", "окт", "ноя", "дек",
];

const MONTHS_FULL = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

/** Exact amount with thin-space groups: `189 033 489`. */
export function money(value: number | null | undefined, fractionDigits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const rounded = fractionDigits > 0 ? value : Math.round(value);
  return rounded
    .toLocaleString("ru-RU", {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    })
    .replace(/ /g, THIN_SPACE);
}

/** Magnitude-aware short form for KPI tiles: `189,0 млн`, `1,2 млрд`. */
export function moneyShort(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const sign = value < 0 ? "−" : "";
  const abs = Math.abs(value);

  if (abs >= 1_000_000_000) return `${sign}${trim(abs / 1_000_000_000)} млрд`;
  if (abs >= 1_000_000) return `${sign}${trim(abs / 1_000_000)} млн`;
  if (abs >= 1_000) return `${sign}${trim(abs / 1_000)} тыс`;
  return `${sign}${Math.round(abs)}`;
}

function trim(value: number): string {
  const digits = value >= 100 ? 0 : 1;
  return value.toFixed(digits).replace(".", ",").replace(/,0$/, "");
}

export function percent(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(digits).replace(".", ",")}%`;
}

export function count(value: number): string {
  return value.toLocaleString("ru-RU").replace(/ /g, THIN_SPACE);
}

/** `2026-06` → `Июнь 2026`. */
export function monthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  if (!year || !month) return key;
  return `${MONTHS_FULL[month - 1]} ${year}`;
}

/** `2026-06` → `июн 26` — for dense axes. */
export function monthShort(key: string): string {
  const [year, month] = key.split("-").map(Number);
  if (!year || !month) return key;
  return `${MONTHS_SHORT[month - 1]} ${String(year).slice(2)}`;
}

/** ISO date → `21.05.2026`. */
export function dateLabel(iso: string | null | undefined): string {
  if (!iso) return "—";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** "обновлено 12 сек назад" — drives the live indicator. */
export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "нет данных";
  const parsed = new Date(iso).getTime();
  if (Number.isNaN(parsed)) return "нет данных";

  const seconds = Math.max(0, Math.round((Date.now() - parsed) / 1000));
  if (seconds < 10) return "только что";
  if (seconds < 60) return `${seconds} сек назад`;

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} ${plural(minutes, "минуту", "минуты", "минут")} назад`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${plural(hours, "час", "часа", "часов")} назад`;

  const days = Math.round(hours / 24);
  return `${days} ${plural(days, "день", "дня", "дней")} назад`;
}

/** Russian plural: 1 день, 2 дня, 5 дней. */
export function plural(n: number, one: string, few: string, many: string): string {
  const mod100 = Math.abs(n) % 100;
  const mod10 = mod100 % 10;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

/** Remaining lifetime of a temporary link, or null when it is permanent. */
export function expiresIn(iso: string | null): string | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  if (ms <= 0) return "истекла";

  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return `${Math.max(1, Math.round(ms / 60_000))} мин`;
  if (hours < 48) return `${hours} ${plural(hours, "час", "часа", "часов")}`;
  const days = Math.round(hours / 24);
  return `${days} ${plural(days, "день", "дня", "дней")}`;
}
