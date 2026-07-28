"use client";

/**
 * FLIP: перестройка сетки как перелёт, а не как перерисовка.
 *
 * Смена плотности меняет разметку целиком — плитки KPI встают в один ряд,
 * карточки перестраиваются в две колонки, второстепенные колонки таблиц уходят.
 * Без анимации это выглядит как мигание: экран моргнул, и всё лежит иначе.
 *
 * Приём стандартный: снять позиции «до», применить изменение, снять позиции
 * «после», вернуть элементы трансформом туда, где они были, и отпустить. Браузер
 * анимирует только `transform` — ни одного пересчёта раскладки за кадр.
 *
 * Ключей у блоков нет и не нужно: раскладку меняет CSS, DOM при этом не
 * пересобирается, поэтому «до» и «после» — это буквально одни и те же узлы.
 * Первая версия искала блоки по `data-flip-id`, и это оказалось ошибкой:
 * половина карточек (те же тринадцать предупреждений) рисуется не через общий
 * SectionCard, атрибута у них нет — и лететь было нечему.
 *
 * Задержка каждого элемента пропорциональна пройденному пути: ближние трогаются
 * первыми, дальние догоняют — то самое ощущение разлетающихся листьев, а не
 * одновременного рывка всей страницы.
 */

/** Всё, что человек воспринимает как отдельный блок. */
const SELECTOR = ".bbc-block-view .card, .bbc-block-view [data-flip-id]";
const MAX_DELAY_MS = 140;
/** Меньше этого сдвиг не заметен, а анимировать его — только грузить компоновщик. */
const MIN_SHIFT_PX = 2;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Только внешние блоки: вложенную карточку нельзя анимировать отдельно от
 * родительской — её трансформ сложился бы с родительским, и она уехала бы вдвое
 * дальше, чем нужно.
 */
function outermost(nodes: HTMLElement[]): HTMLElement[] {
  return nodes.filter((node) => !nodes.some((other) => other !== node && other.contains(node)));
}

/**
 * Выполнить `apply()` так, чтобы блоки перелетели на новые места.
 *
 * `apply` обязан менять раскладку синхронно — например, переключать атрибут на
 * `<html>`, от которого зависят правила CSS. Асинхронный рендер React измерять
 * «после» уже поздно.
 */
export function flip(apply: () => void, duration = "var(--dur-tell)"): void {
  if (typeof document === "undefined" || prefersReducedMotion()) {
    apply();
    return;
  }

  const nodes = outermost([...document.querySelectorAll<HTMLElement>(SELECTOR)]);
  const before = nodes.map((node) => node.getBoundingClientRect());

  apply();

  // Самый длинный перелёт задаёт шкалу задержек: на узком экране блоки едут на
  // десятки пикселей, на широком — на сотни, и фиксированный шаг сыпался бы.
  let longest = 1;
  const moves: Array<{ node: HTMLElement; dx: number; dy: number; distance: number }> = [];

  nodes.forEach((node, index) => {
    const start = before[index];
    const end = node.getBoundingClientRect();
    const dx = start.left - end.left;
    const dy = start.top - end.top;
    const distance = Math.hypot(dx, dy);
    if (distance < MIN_SHIFT_PX) return;

    moves.push({ node, dx, dy, distance });
    longest = Math.max(longest, distance);
  });

  if (!moves.length) return;

  for (const { node, dx, dy } of moves) {
    node.style.transition = "none";
    node.style.transform = `translate(${dx}px, ${dy}px)`;
    node.style.willChange = "transform";
  }

  // Один принудительный пересчёт на всю партию — иначе браузер схлопнет
  // «поставили трансформ» и «сняли трансформ» в один кадр, и полёта не будет.
  void document.body.offsetHeight;

  for (const { node, distance } of moves) {
    const delay = Math.round((distance / longest) * MAX_DELAY_MS);

    node.style.transition = `transform ${duration} var(--ease-out) ${delay}ms`;
    node.style.transform = "";

    const done = () => {
      node.style.transition = "";
      node.style.willChange = "";
      node.removeEventListener("transitionend", done);
    };
    node.addEventListener("transitionend", done);
  }
}
