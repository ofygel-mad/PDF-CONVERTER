"use client";

/**
 * Блокировка прокрутки фона, пока открыт модальный слой.
 *
 * Живёт не в модуле дашборда, а рядом с иконками: им пользуются и модалки
 * воркбенча, и шиты BBC. У модуля дашборда в README описано, как его удалить
 * целиком, — общая утилита внутри него сделала бы это описание неверным.
 *
 * Почему `position: fixed`, а не `overflow: hidden`: на iOS Safari `overflow`
 * на body просто игнорируется — страница под модалкой продолжает ехать.
 * Приходится вынимать её из потока и запоминать смещение руками.
 *
 * Счётчик ссылок обязателен: шиты открываются поверх шитов, и наивный
 * «заблокировал/разблокировал» вернул бы прокрутку по закрытию верхнего,
 * пока нижний ещё открыт.
 */
import { useEffect } from "react";

let locks = 0;
let savedScrollY = 0;
let savedStyles: {
  position: string;
  top: string;
  left: string;
  right: string;
  width: string;
  overflowY: string;
} | null = null;

function engage() {
  const { body } = document;
  savedScrollY = window.scrollY;
  savedStyles = {
    position: body.style.position,
    top: body.style.top,
    left: body.style.left,
    right: body.style.right,
    width: body.style.width,
    overflowY: body.style.overflowY,
  };

  body.style.position = "fixed";
  body.style.top = `-${savedScrollY}px`;
  body.style.left = "0";
  body.style.right = "0";
  body.style.width = "100%";
  // Полоса прокрутки остаётся зарезервированной, иначе на десктопе страница
  // дёргается вбок на её ширину в момент открытия.
  body.style.overflowY = "scroll";

  // Состояние на <html> — тем же приёмом, что и плотность: правила из
  // globals.css достают до чего угодно без прокидывания пропа.
  document.documentElement.dataset.bbcSheet = "open";
}

function release() {
  const { body } = document;
  if (savedStyles) {
    body.style.position = savedStyles.position;
    body.style.top = savedStyles.top;
    body.style.left = savedStyles.left;
    body.style.right = savedStyles.right;
    body.style.width = savedStyles.width;
    body.style.overflowY = savedStyles.overflowY;
    savedStyles = null;
  }
  delete document.documentElement.dataset.bbcSheet;

  // Возврат ровно туда, где стояли: `position: fixed` уже сбросил прокрутку в
  // ноль, поэтому без этого закрытие модалки выбрасывало бы наверх страницы.
  window.scrollTo({ top: savedScrollY, behavior: "auto" });
}

/** Держит прокрутку фона заблокированной, пока `active` истинно. */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;

    locks += 1;
    if (locks === 1) engage();

    return () => {
      locks -= 1;
      if (locks === 0) release();
    };
  }, [active]);
}
