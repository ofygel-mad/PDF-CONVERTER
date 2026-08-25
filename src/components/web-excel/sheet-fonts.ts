/**
 * Подгрузка шрифтов, которыми набран импортированный лист.
 *
 * Univer рисует таблицу в canvas, а не версткой. У canvas нет подбора похожего
 * шрифта: незагруженное семейство не заменяется близким, а падает в засечковый
 * шрифт по умолчанию. Книга, набранная Montserrat, приезжала Times New Roman —
 * то же содержимое, но узнать в нём свою таблицу человек уже не может.
 *
 * Ждать `document.fonts.load` обязательно, а не желательно: canvas меряет
 * ширину текста в момент отрисовки, и если шрифт доедет после, останутся
 * ширины чужого шрифта — текст полезет из ячеек, которые в Google не текут.
 */

/** Шрифты, которые есть в системе: тянуть их из сети нечего и неоткуда. */
const SYSTEM_FONTS = new Set(
  [
    "arial",
    "helvetica",
    "helvetica neue",
    "times new roman",
    "times",
    "courier new",
    "courier",
    "verdana",
    "georgia",
    "tahoma",
    "trebuchet ms",
    "impact",
    "comic sans ms",
    "segoe ui",
    "calibri",
    "cambria",
    "consolas",
    "sans-serif",
    "serif",
    "monospace",
  ].map((name) => name.toLowerCase()),
);

const loaded = new Set<string>();

function familyToQuery(family: string): string {
  // Google Fonts CSS2 ждёт «Open+Sans»; начертания перечисляем явно, иначе
  // придёт только 400, и жирная шапка листа окажется не жирной.
  return `family=${encodeURIComponent(family).replace(/%20/g, "+")}:wght@400;500;600;700`;
}

/**
 * Загружает переданные семейства и ждёт, пока браузер их действительно получит.
 * Возвращает управление и при отказе сети — таблица важнее шрифта.
 */
export async function ensureSheetFonts(families: string[]): Promise<void> {
  if (typeof document === "undefined") return;

  const wanted = families
    .map((family) => family.trim())
    .filter((family) => family && !SYSTEM_FONTS.has(family.toLowerCase()) && !loaded.has(family));

  if (wanted.length === 0) return;
  wanted.forEach((family) => loaded.add(family));

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?${wanted.map(familyToQuery).join("&")}&display=swap`;

  const arrived = new Promise<void>((resolve) => {
    link.onload = () => resolve();
    link.onerror = () => resolve();
    // Ждать бесконечно нельзя: без сети до Google Fonts таблица не должна
    // не открыться вовсе — она должна открыться запасным шрифтом.
    setTimeout(resolve, 4000);
  });

  document.head.appendChild(link);
  await arrived;

  try {
    await Promise.all(
      wanted.flatMap((family) => [
        document.fonts.load(`400 12px "${family}"`),
        document.fonts.load(`700 12px "${family}"`),
      ]),
    );
  } catch {
    /* шрифт не доехал — рисуем запасным */
  }
}
