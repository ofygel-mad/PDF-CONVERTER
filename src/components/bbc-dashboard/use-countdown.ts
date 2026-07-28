"use client";

/**
 * Обратный отсчёт до момента времени.
 *
 * Нужен там, где срок — не справка, а событие: временная ссылка отдела должна на
 * глазах дойти до нуля и исчезнуть, а не оставаться в поле «действующей» до
 * следующей перезагрузки страницы. Пока срока нет, таймер не заводится вовсе.
 */
import { useEffect, useState } from "react";

import { plural } from "./format";

export type Countdown = {
  /** Осталось миллисекунд; 0 — время вышло. */
  remaining: number;
  /** Строка для интерфейса: «3 ч 15 мин», «4:59», «истекла». */
  label: string;
  /** True в последнюю минуту — повод покрасить строку в тревожный тон. */
  urgent: boolean;
  /** True, когда срок был и уже прошёл. */
  expired: boolean;
};

const NONE: Countdown = { remaining: 0, label: "", urgent: false, expired: false };

export function useCountdown(iso: string | null | undefined): Countdown {
  const deadline = iso ? new Date(iso).getTime() : null;
  const valid = deadline !== null && !Number.isNaN(deadline);

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!valid) return;

    const target = new Date(iso as string).getTime();
    let timer: ReturnType<typeof setTimeout>;

    // Пока до конца больше двух минут, секундная точность никому не нужна:
    // хватает пятнадцати секунд. Последние две минуты тикают по секунде — там
    // счёт уже важен. Самопланирующийся таймаут, а не интервал: шаг меняется
    // по ходу дела, и лишних срабатываний не остаётся.
    const schedule = () => {
      const left = target - Date.now();
      timer = setTimeout(
        () => {
          setNow(Date.now());
          // Один тик после нуля нужен, чтобы строка успела стать «истекла».
          if (left > 0) schedule();
        },
        left > 120_000 ? 15_000 : 1_000,
      );
    };

    schedule();
    return () => clearTimeout(timer);
  }, [valid, iso]);

  if (!valid) return NONE;

  const remaining = Math.max(0, (deadline as number) - now);
  return {
    remaining,
    label: formatRemaining(remaining),
    urgent: remaining > 0 && remaining <= 60_000,
    expired: remaining === 0,
  };
}

/** «истекла» · «4:59» · «3 ч 15 мин» · «6 дней». */
export function formatRemaining(ms: number): string {
  if (ms <= 0) return "истекла";

  const totalSeconds = Math.ceil(ms / 1000);
  if (totalSeconds < 3600) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  const totalMinutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  if (hours < 48) {
    const minutes = totalMinutes % 60;
    return minutes ? `${hours} ч ${minutes} мин` : `${hours} ${plural(hours, "час", "часа", "часов")}`;
  }

  const days = Math.round(hours / 24);
  return `${days} ${plural(days, "день", "дня", "дней")}`;
}

/** «сегодня в 21:40» / «29 июля в 09:15» — когда именно доступ кончится. */
export function deadlineLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  const time = date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  const sameDay = date.toDateString() === new Date().toDateString();
  if (sameDay) return `сегодня в ${time}`;

  const day = date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
  return `${day} в ${time}`;
}
