/**
 * Отделы: код из таблицы → человеческое название и свой тон.
 *
 * Экран, открытый по ссылке отдела, должен с первого взгляда читаться как «мой
 * отдел», а не как общий дашборд, которому забыли что-то показать. Отличается он
 * названием, тоном шапки и составом разделов.
 *
 * Тон берётся из уже существующего семейства токенов и новых цветов не вводит:
 * правило дизайн-системы — один акцент на продукт. Отделы различаются
 * распределением того, что уже есть, а не новой краской.
 */
export type Department = {
  code: string;
  /** Полное название — то, что человек ожидает увидеть про себя. */
  name: string;
  /** Родительный падеж для фраз вида «данные юридического отдела». */
  genitive: string;
  tone: string;
  soft: string;
};

const DEPARTMENTS: Record<string, Department> = {
  ОБО: {
    code: "ОБО",
    name: "Бухгалтерский отдел",
    genitive: "бухгалтерского отдела",
    tone: "var(--accent-emerald)",
    soft: "color-mix(in srgb, var(--accent-emerald) 12%, transparent)",
  },
  НО: {
    code: "НО",
    name: "Налоговый отдел",
    genitive: "налогового отдела",
    tone: "var(--accent-amber)",
    soft: "color-mix(in srgb, var(--accent-amber) 12%, transparent)",
  },
  ЮО: {
    code: "ЮО",
    name: "Юридический отдел",
    genitive: "юридического отдела",
    tone: "var(--accent)",
    soft: "var(--accent-soft)",
  },
  HR: {
    code: "HR",
    name: "Кадровый отдел",
    genitive: "кадрового отдела",
    tone: "var(--accent-rose)",
    soft: "color-mix(in srgb, var(--accent-rose) 12%, transparent)",
  },
  ФО: {
    code: "ФО",
    name: "Финансовый отдел",
    genitive: "финансового отдела",
    tone: "var(--text-primary)",
    soft: "var(--bg-active)",
  },
};

/** Отдел по коду. Неизвестный код — не повод падать: показываем сам код. */
export function department(code: string | null | undefined): Department | null {
  if (!code) return null;
  const key = code.trim().toUpperCase();
  return (
    DEPARTMENTS[key] ?? {
      code,
      name: `Отдел ${code}`,
      genitive: `отдела ${code}`,
      tone: "var(--accent)",
      soft: "var(--accent-soft)",
    }
  );
}

