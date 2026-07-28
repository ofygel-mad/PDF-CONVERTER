"use client";

/**
 * Ширина экрана — для того, что невидимо, когда угадано неверно.
 *
 * Правило по всему модулю: если неверный первый кадр будет виден, решает CSS;
 * если он невидим — закрытый шит, обработчик подсказки, — можно спросить JS.
 * Поэтому раскладка нигде не зависит от этого хука: сервер не знает ширины
 * окна, отдаёт `false`, и на телефоне первый кадр всё равно был бы десктопным.
 *
 * Плотность (`data-bbc-density` на <html>) тут не образец для подражания: она —
 * состояние пользователя, у CSS нет способа его узнать. Ширину окна CSS знает
 * сам, и дублировать её атрибутом значит завести слушатель resize и вернуть тот
 * самый неверный кадр.
 */
import { useSyncExternalStore } from "react";

/** Ниже sm у Tailwind. Не 640: на ровно 640 уже работают утилиты `sm:`. */
export const MOBILE_QUERY = "(max-width: 639.98px)";

// Один MediaQueryList на запрос: хук зовут из десятка мест, а слушатель браузеру
// хватит и одного.
const lists = new Map<string, MediaQueryList>();

function listFor(query: string): MediaQueryList {
  let list = lists.get(query);
  if (!list) {
    list = window.matchMedia(query);
    lists.set(query, list);
  }
  return list;
}

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = listFor(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => listFor(query).matches,
    // Серверный снапшот. React примет его и в первый клиентский кадр, а уточнит
    // уже в эффекте — расхождения гидратации не будет, но и рисовать по этому
    // значению раскладку нельзя.
    () => false,
  );
}

/** Телефон — всё, что уже узкого края `sm`. */
export function useIsMobile(): boolean {
  return useMediaQuery(MOBILE_QUERY);
}
