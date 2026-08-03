"use client";

/**
 * Экран первой загрузки.
 *
 * Раньше здесь крутился 16-пиксельный значок — обычный спиннер, который ничего
 * не говорит и вращается одинаково что три секунды, что тридцать.
 *
 * Теперь это собственный знак продукта, увеличенный и ожившый: столбцы отчёта
 * поднимаются от основания по очереди и дышат, пока идёт чтение. Ожидание
 * показывает то, чего ждут, — управленческий отчёт, — а не абстрактную
 * загрузку.
 *
 * Подпись называет фазу по имени, и фаз ровно две, потому что ровно столько
 * фронт наблюдает: проверка доступа и чтение таблицы. Придумать третью значило
 * бы соврать про то, где висим, — а весь смысл подписи именно в этом.
 *
 * Затянулось — появляется правдивая оговорка про первое чтение. Она приходит
 * через семь секунд, а не сразу: сказанная заранее, она оправдывает ожидание,
 * которого в обычном случае нет.
 */
import { useEffect, useState } from "react";

import { BbcDashboardIcon } from "../icon";
import type { BbcLoadPhase } from "../use-dataset";

/** Столбцы. Высоты в процентах — рисунок повторяет знак продукта, а не ровный ряд. */
const BARS = [38, 62, 46, 84, 58, 100];

/** Через сколько признать, что это надолго. */
const SLOW_AFTER_MS = 7000;

const PHASE_LABEL: Record<BbcLoadPhase, string> = {
  auth: "Проверяем доступ",
  reading: "Читаем таблицу",
  done: "Готово",
};

export function BootScreen({ phase }: { phase: BbcLoadPhase }) {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className="bbc-boot-screen min-h-screen min-h-[100svh] flex flex-col items-center justify-center px-6"
      style={{ background: "var(--page-bg)" }}
      role="status"
      aria-live="polite"
    >
      <div className="bbc-boot-chart" aria-hidden="true">
        {BARS.map((height, index) => (
          <span
            key={index}
            className="bbc-boot-bar"
            data-accent={index === BARS.length - 1 ? "" : undefined}
            style={{ height: `${height}%`, ["--i" as string]: index }}
          />
        ))}
      </div>

      <div className="flex flex-col items-center gap-2 text-center" style={{ marginTop: "clamp(1.5rem, 4vh, 2.75rem)" }}>
        <p className="mono-meta bbc-boot-phase">{PHASE_LABEL[phase]}</p>
        {slow ? (
          <p className="text-xs bbc-boot-note" style={{ color: "var(--text-muted)" }}>
            Первое чтение таблицы занимает несколько секунд — дальше данные приходят из памяти.
          </p>
        ) : null}
      </div>

      {/* Знак продукта мелко внизу: он же стоит в сайдбаре, и взгляд после
          загрузки идёт туда. */}
      <span className="bbc-boot-mark" style={{ marginTop: "clamp(2rem, 6vh, 4rem)" }} aria-hidden="true">
        <BbcDashboardIcon size={13} />
        BBC · управленческий отчёт
      </span>
    </div>
  );
}

/**
 * Экран не исчезает, а расходится.
 *
 * Данные приехали — дашборд монтируется сразу и проявляется своим обычным
 * входом (`.bbc-enter`, снизу вверх, со сдвижкой). Экран загрузки в этот момент
 * ещё держится сверху и уходит за 360мс: столбцы складываются вниз, полотно
 * тает. Два движения накладываются и читаются как одно.
 *
 * Возвращает `true`, пока прощальный слой ещё нужен.
 */
export function useBootFarewell(active: boolean): boolean {
  const [leaving, setLeaving] = useState(false);
  const [wasActive, setWasActive] = useState(active);

  if (active !== wasActive) {
    setWasActive(active);
    // Гасим только переход «был → нет». Обратный (перезагрузка данных руками)
    // экрана загрузки не показывает и прощаться ему не с чем.
    if (!active) setLeaving(true);
  }

  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(() => setLeaving(false), 380);
    return () => clearTimeout(timer);
  }, [leaving]);

  return leaving;
}
