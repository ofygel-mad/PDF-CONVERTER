/**
 * Сводка по касаниям — то, ради чего журнал и заводили.
 *
 * Вопрос звучал буквально так: «Жанара 3 раза писала главбуху, 1 раз
 * проджект-менеджеру, потом я писал туда как директор, а ассистентка — жене
 * основателя». Здесь этот вопрос и превращается в цифры.
 *
 * Функции чистые и без React: их можно проверить, не поднимая страницу.
 */
import type { BbcTouch } from "../../types";

export type AuthorSummary = {
  author: string;
  total: number;
  /** По кому именно, от частого к редкому. */
  roles: { role: string; count: number }[];
  lastContact: string | null;
};

export type TouchesOverview = {
  total: number;
  clients: number;
  authors: AuthorSummary[];
  /** Дата последнего касания вообще — «когда мы трогали это в последний раз». */
  lastContact: string | null;
  withFiles: number;
};

function laterOf(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

/** Свод по авторам: кто сколько раз и до кого достучался. */
export function summarizeAuthors(touches: BbcTouch[]): AuthorSummary[] {
  const byAuthor = new Map<string, { total: number; roles: Map<string, number>; last: string | null }>();

  for (const touch of touches) {
    const entry = byAuthor.get(touch.author) ?? { total: 0, roles: new Map(), last: null };
    entry.total += 1;
    entry.roles.set(touch.contact_role_name, (entry.roles.get(touch.contact_role_name) ?? 0) + 1);
    entry.last = laterOf(entry.last, touch.contacted_at);
    byAuthor.set(touch.author, entry);
  }

  return [...byAuthor.entries()]
    .map(([author, entry]) => ({
      author,
      total: entry.total,
      roles: [...entry.roles.entries()]
        .map(([role, count]) => ({ role, count }))
        // От частого к редкому: «3 раза главбуху» важнее «1 раз ассистенту».
        .sort((a, b) => b.count - a.count || a.role.localeCompare(b.role, "ru")),
      lastContact: entry.last,
    }))
    .sort((a, b) => b.total - a.total || a.author.localeCompare(b.author, "ru"));
}

export function overview(touches: BbcTouch[]): TouchesOverview {
  const clients = new Set<string>();
  let last: string | null = null;
  let withFiles = 0;

  for (const touch of touches) {
    clients.add(touch.client_key);
    last = laterOf(last, touch.contacted_at);
    if (touch.files.length) withFiles += 1;
  }

  return {
    total: touches.length,
    clients: clients.size,
    authors: summarizeAuthors(touches),
    lastContact: last,
    withFiles,
  };
}

/**
 * Свод одного автора одной строкой: «3 раза главбуху · 1 раз проджект-менеджеру».
 *
 * Именно так это и просили прочитать — предложением, а не таблицей на пять
 * колонок, в которой те же два числа надо ещё найти.
 */
export function describeAuthor(summary: AuthorSummary): string {
  return summary.roles
    .map((item) => `${item.count} ${plural(item.count, "раз", "раза", "раз")} ${dative(item.role)}`)
    .join(" · ");
}

function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

/**
 * Должность в дательный падеж: «писала главбуху», а не «писала главбух».
 *
 * Таблицей, а не правилом: должностей одиннадцать штук и список закрыт, а
 * склонятор ради одиннадцати строк — это библиотека, которая однажды выдаст
 * «супруг(а) учредителю».
 */
const DATIVE: Record<string, string> = {
  "Главный бухгалтер": "главбуху",
  "Бухгалтер": "бухгалтеру",
  "Финансовый директор": "финдиректору",
  "Директор": "директору",
  "Проджект-менеджер": "проджект-менеджеру",
  "Ассистент": "ассистенту",
  "Учредитель": "учредителю",
  "Супруг(а) учредителя": "супруге учредителя",
  "Юрист": "юристу",
  "Снабжение": "в снабжение",
  "Другое": "прочим",
};

function dative(role: string): string {
  return DATIVE[role] ?? role.toLowerCase();
}
