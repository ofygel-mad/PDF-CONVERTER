"use client";

/**
 * Докрутка числа от прошлого значения к новому.
 *
 * Зачем: когда переключают вариант признания, цифры меняются скачком и глаз не
 * успевает связать «было» и «стало». Докрутка за полсекунды показывает движение
 * — видно не только новое число, но и в какую сторону оно ушло.
 *
 * Считаем через requestAnimationFrame и easing, а не линейно: линейный отсчёт
 * выглядит механическим. Под prefers-reduced-motion анимация отключается — число
 * ставится сразу.
 */
import { useEffect, useRef, useState } from "react";

const DURATION = 560;

/** Плавное замедление к концу — то же ощущение, что у --ease-out в CSS. */
function easeOut(t: number): number {
  return 1 - (1 - t) ** 3;
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useCountUp(value: number): number {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (from.current === value) return;

    if (prefersReducedMotion()) {
      from.current = value;
      setShown(value);
      return;
    }

    const start = performance.now();
    const origin = from.current;
    const delta = value - origin;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / DURATION);
      setShown(origin + delta * easeOut(progress));
      if (progress < 1) {
        frame.current = requestAnimationFrame(tick);
      } else {
        from.current = value;
        frame.current = null;
      }
    };

    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      // Прерванная анимация не должна «застревать» на полпути: следующая
      // докрутка стартует с того, что человек видит сейчас.
      from.current = shown;
    };
    // `shown` намеренно не в зависимостях — иначе эффект перезапускался бы
    // на каждом кадре анимации.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return shown;
}
