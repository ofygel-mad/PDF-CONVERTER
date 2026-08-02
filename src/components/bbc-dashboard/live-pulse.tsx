"use client";

/**
 * Пульс живой связи с таблицей.
 *
 * Заменяет цветную точку в шапке. Точка была плоха не формой, а тем, что горела
 * зелёным всё время: подсвечивалось состояние «всё хорошо», то есть 99% времени,
 * и к моменту, когда индикатор должен был напугать, его переставали замечать.
 *
 * Здесь наоборот. В покое трасса графитовая и почти ровная — её видно, но она не
 * требует внимания. Смысл несёт движение, и движение это честное: линия
 * сдвигается ровно на один удар за один успешный опрос (раз в 5 секунд), а не
 * крутится бесконечным лупом. Встала линия — встал опрос, и это видно без
 * подписи. Всплеск сапфиром — не украшение: он рисуется только когда сдвинулся
 * revision, то есть ровно в тот момент, когда цифры на экране поменялись.
 *
 * Оба отказа — неподвижные фигуры: прямая (янтарь) — «сервер молчит», разрыв
 * (красный) — «бэкенд жив, но таблицу больше не читает». Цвет появляется только
 * на отказе и на правке, в покое его нет вовсе.
 */
import { useEffect, useId, useRef, useState } from "react";

import type { LiveState } from "./use-live";

/** Ширина одного удара и базовая линия — в координатах SVG, 1 единица = 1px. */
const STEP = 9;
const MID = 7;
const H = 14;

/** Сколько ударов помещается в трассу: в однострочной шапке телефона места меньше. */
const SLOTS = { compact: 4, full: 7 };

/**
 * Буфер всегда длиной под самую широкую трассу, окно нарезается на рендере.
 *
 * Так брейкпоинт не трогает состояние вовсе: смена ширины не роняет историю
 * ударов и не требует эффекта, который синхронизировал бы длину буфера.
 * На один удар больше, чем видно, — лишний висит за правым краем и въезжает
 * в кадр анимацией сдвига.
 */
const BUFFER = SLOTS.full + 1;

type Beat = { id: number; spike: boolean };

/** Хвост «до первого опроса»: трасса не должна стартовать пустой дырой. */
function restingBeats(count: number): Beat[] {
  return Array.from({ length: count }, (_, index) => ({ id: index - count, spike: false }));
}

/** Кольцевой буфер ударов, набиваемый из реальных опросов. */
function usePulse(live: LiveState): Beat[] {
  const [beats, setBeats] = useState<Beat[]>(() => restingBeats(BUFFER));
  const sequence = useRef(0);
  const lastPolled = useRef<number | null>(null);
  const lastRevision = useRef(live.revision);
  // Первый опрос только задаёт точку отсчёта.
  const primed = useRef(false);

  useEffect(() => {
    if (!live.polledAt || live.polledAt === lastPolled.current) return;
    lastPolled.current = live.polledAt;

    // Всплеск — только на реальном движении revision. Успешный опрос, ничего не
    // нашедший, — это зыбь, а не событие.
    //
    // Первый опрос исключён намеренно: до него revision равен нулю, и любое
    // живое значение выглядело бы как правка. Трасса при каждой загрузке
    // страницы показывала всплеск, которого не было, — а всплеск здесь обещает
    // ровно одно: цифры на экране только что поменялись.
    const spike = primed.current && live.revision > lastRevision.current;
    primed.current = true;
    lastRevision.current = live.revision;

    sequence.current += 1;
    const beat: Beat = { id: sequence.current, spike };
    setBeats((previous) => [...previous.slice(1), beat]);
  }, [live.polledAt, live.revision]);

  return beats;
}

/**
 * Ломаная по ударам.
 *
 * Рисуется от -STEP: самый левый удар живёт за кадром и уезжает из него, поэтому
 * в покое трасса стоит без смещения, а анимация возвращает её из translateX(STEP).
 */
function tracePath(beats: Beat[]): string {
  let d = `M ${-STEP} ${MID}`;
  beats.forEach((beat, index) => {
    const x = (index - 1) * STEP;
    d += beat.spike
      ? ` L ${x + 1.8} ${MID} L ${x + 3.2} ${MID - 5.6} L ${x + 4.6} ${MID + 4.4} L ${x + 6} ${MID}`
      : ` L ${x + 3.6} ${MID} L ${x + 4.5} ${MID - 1.1} L ${x + 5.4} ${MID + 0.8} L ${x + 6.2} ${MID}`;
    d += ` L ${x + STEP} ${MID}`;
  });
  return d;
}

export function LivePulse({ live, compact = false }: { live: LiveState; compact?: boolean }) {
  const slots = compact ? SLOTS.compact : SLOTS.full;
  const buffer = usePulse(live);
  const beats = buffer.slice(buffer.length - (slots + 1));
  const width = STEP * slots;

  // useId отдаёт скобки и двоеточия, недопустимые в url(#…) — оставляем буквы.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");

  const failing = live.online && !!live.sourceError;

  // Отказ — неподвижная фигура. Остановка движения и есть сообщение; трассу с
  // ударами здесь рисовать нельзя, она означала бы, что данные всё ещё идут.
  if (!live.online || failing) {
    return (
      <svg
        width={width}
        height={H}
        viewBox={`0 0 ${width} ${H}`}
        aria-hidden="true"
        style={{ display: "block" }}
      >
        <path
          d={
            failing
              ? `M 0 ${MID} L ${(width * 0.36).toFixed(1)} ${MID} M ${(width * 0.64).toFixed(1)} ${MID} L ${width} ${MID}`
              : `M 0 ${MID} L ${width} ${MID}`
          }
          fill="none"
          stroke={failing ? "var(--accent-rose)" : "var(--accent-amber)"}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
      </svg>
    );
  }

  const newest = beats[beats.length - 1];

  return (
    <svg
      width={width}
      height={H}
      viewBox={`0 0 ${width} ${H}`}
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <defs>
        {/* Слева трасса уходит в ничто, а не обрубается краем кадра. */}
        <linearGradient id={`pulse-fade-${uid}`} x1="0" x2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.3" stopColor="#fff" stopOpacity="1" />
        </linearGradient>
        <mask id={`pulse-mask-${uid}`}>
          <rect x="0" y="0" width={width} height={H} fill={`url(#pulse-fade-${uid})`} />
        </mask>
      </defs>

      <g mask={`url(#pulse-mask-${uid})`}>
        {/* key перемонтирует группу на каждом ударе — только так CSS-анимация
            сдвига запускается заново, без ручного сброса через reflow. */}
        <g
          key={newest.id}
          className="bbc-pulse-shift"
          style={{ "--bbc-pulse-step": `${STEP}px` } as React.CSSProperties}
        >
          <path
            className={newest.spike ? "bbc-pulse-spike" : undefined}
            d={tracePath(beats)}
            fill="none"
            stroke="var(--text-muted)"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </g>
    </svg>
  );
}
