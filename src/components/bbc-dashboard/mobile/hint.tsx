"use client";

/**
 * Подсказка, которую можно достать пальцем.
 *
 * `title=` на сенсорном экране не срабатывает никогда — а в дашборде в нём
 * местами лежат сами данные: точная сумма под сокращением «189 млн», разбивка
 * колонки по циклам, причина, по которой строка не признана.
 *
 * Показывать точку справки решает CSS (`@media (hover: none)`), а не хук ширины:
 * иначе на телефоне первый кадр пришёл бы без неё, и она выскакивала бы уже
 * после гидратации. JS отвечает только за сам поповер — он невидим, пока
 * закрыт, поэтому неверно угаданное состояние там ничего не стоит.
 *
 * Длинное нажатие сознательно не сделано: оно воюет с выделением текста и с
 * системным меню, а главное — о нём неоткуда узнать. Точка занимает 24px и
 * говорит сама за себя.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { InfoIcon } from "../icon";

export function Hint({
  text,
  children,
  label = "Подробнее",
}: {
  text: string;
  /** То, что объясняется. На десктопе получает тот же `title`, что и раньше. */
  children?: ReactNode;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<{ top: number; left: number } | null>(null);
  const anchorRef = useRef<HTMLButtonElement>(null);

  const show = useCallback(() => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (rect) setBox({ top: rect.bottom + 6, left: rect.left + rect.width / 2 });
    setOpen(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    // Скролл закрывает: поповер привязан к координатам, снятым один раз, и
    // вместе со страницей он не поедет.
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <span className="inline-flex items-center gap-1 align-middle" title={text}>
        {children}
        <button
          ref={anchorRef}
          type="button"
          aria-label={label}
          aria-expanded={open}
          onClick={(event) => {
            event.stopPropagation();
            show();
          }}
          className="bbc-hint-dot shrink-0 items-center justify-center"
          style={{ width: 24, height: 24, color: "var(--text-muted)" }}
        >
          <InfoIcon size={14} />
        </button>
      </span>

      {open && box
        ? createPortal(
            <>
              <button
                type="button"
                aria-label="Закрыть подсказку"
                onClick={() => setOpen(false)}
                className="fixed inset-0 z-[60]"
                style={{ background: "transparent" }}
              />
              <div
                role="tooltip"
                className="fixed z-[60] card px-3 py-2 text-xs animate-fade-in"
                style={{
                  top: box.top,
                  left: box.left,
                  // Держим поповер в пределах экрана: у правого края
                  // центрирование иначе увело бы его за границу.
                  transform: "translateX(-50%)",
                  maxWidth: "min(18rem, calc(100vw - 2rem))",
                  color: "var(--text-secondary)",
                  boxShadow: "var(--shadow-float)",
                  animationDuration: "var(--dur-fast)",
                }}
              >
                {text}
              </div>
            </>,
            document.body,
          )
        : null}
    </>
  );
}
