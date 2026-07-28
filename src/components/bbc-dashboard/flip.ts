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
 * Задержка каждого элемента пропорциональна пройденному пути: ближние трогаются
 * первыми, дальние догоняют — то самое ощущение разлетающихся листьев, а не
 * одновременного рывка всей страницы.
 */

const FLIP_ATTR = "data-flip-id";
const MAX_DELAY_MS = 140;
/** Меньше этого сдвиг не заметен, а анимировать его — только грузить компоновщик. */
const MIN_SHIFT_PX = 2;

type Rects = Map<string, DOMRect>;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function collect(): Rects {
  const rects: Rects = new Map();
  if (typeof document === "undefined") return rects;
  for (const node of document.querySelectorAll<HTMLElement>(`[${FLIP_ATTR}]`)) {
    const id = node.getAttribute(FLIP_ATTR);
    if (id) rects.set(id, node.getBoundingClientRect());
  }
  return rects;
}

/**
 * Выполнить `apply()` так, чтобы элементы с `data-flip-id` перелетели.
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

  const before = collect();
  apply();
  const after = collect();

  // Самый длинный перелёт задаёт шкалу задержек: на узком экране блоки едут на
  // десятки пикселей, на широком — на сотни, и фиксированный шаг сыпался бы.
  let longest = 1;
  const moves: Array<{ node: HTMLElement; dx: number; dy: number; distance: number }> = [];

  for (const [id, start] of before) {
    const end = after.get(id);
    if (!end) continue;

    const dx = start.left - end.left;
    const dy = start.top - end.top;
    const distance = Math.hypot(dx, dy);
    if (distance < MIN_SHIFT_PX) continue;

    const node = document.querySelector<HTMLElement>(`[${FLIP_ATTR}="${CSS.escape(id)}"]`);
    if (!node) continue;

    moves.push({ node, dx, dy, distance });
    longest = Math.max(longest, distance);
  }

  for (const move of moves) {
    const { node, dx, dy } = move;

    node.style.transition = "none";
    node.style.transform = `translate(${dx}px, ${dy}px)`;
    node.style.willChange = "transform";
  }

  // Один принудительный пересчёт на всю партию — иначе браузер схлопнет
  // «поставили трансформ» и «сняли трансформ» в один кадр, и полёта не будет.
  if (moves.length) void document.body.offsetHeight;

  for (const move of moves) {
    const { node, distance } = move;
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
