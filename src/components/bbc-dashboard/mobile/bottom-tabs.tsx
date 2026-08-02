"use client";

/**
 * Нижний таб-бар — навигация дашборда на телефоне.
 *
 * Лента вкладок наверху не работала: девять разделов уезжали за правый край без
 * единого признака, что там что-то есть. Внизу помещается четыре, пятой идёт
 * «Ещё» — и, в отличие от ленты, все четыре видны всегда.
 *
 * Состав выводится из того, что разрешено вызывающему, а не задан списком:
 * реферальная ссылка отдела открывает три-четыре раздела, и жёстко зашитая
 * четвёрка оставила бы такому пользователю «Ещё» с одним пунктом внутри.
 */
import type { CSSProperties } from "react";

import { MoreIcon } from "../icon";

export type TabBlock = {
  key: string;
  title: string;
  short: string;
  icon: (props: { size?: number }) => React.ReactElement;
};

/**
 * Порядок предпочтения для нижнего бара.
 *
 * Дебиторка — раздел по умолчанию и ответ на вопрос «сколько нам должны».
 * Календарь — «когда придут деньги и что просрочено», самая действенная
 * поверхность. Предупреждения — единственный раздел с живым счётчиком, а бейджи
 * и есть то, ради чего таб-бары существуют. Отчёты — собственно управленческий
 * отчёт.
 *
 * Аналитика и Журнал остаются в «Ещё» осознанно: это работа за столом, и один
 * тап вглубь для них честен. Панель управления — тоже, у неё есть второй вход
 * из строки контекста.
 */
const PRIORITY = ["receivables", "calendar", "warnings", "reports"];

const MAX_TABS = 5;

/**
 * Делит разделы на бар и лист «Ещё».
 *
 * Живёт здесь и экспортируется, потому что оболочке нужен тот же результат:
 * она решает, что показать в листе и подсвечивать ли «Ещё». Два независимых
 * расчёта разошлись бы при первой же правке приоритетов.
 */
export function splitTabs(blocks: TabBlock[]): { tabs: TabBlock[]; rest: TabBlock[] } {
  const primary = PRIORITY.filter((key) => blocks.some((item) => item.key === key))
    .slice(0, MAX_TABS - 1)
    .map((key) => blocks.find((item) => item.key === key)!);

  const rest = blocks.filter((item) => !primary.includes(item));

  // Когда прятать нечего, пятое место отдаётся разделу, а не кнопке «Ещё».
  return rest.length ? { tabs: primary, rest } : { tabs: blocks.slice(0, MAX_TABS), rest: [] };
}

export function BottomTabs({
  blocks,
  activeKey,
  warningCount,
  onSelect,
  onMore,
  moreActive,
}: {
  blocks: TabBlock[];
  activeKey: string | undefined;
  warningCount: number;
  onSelect: (key: string) => void;
  onMore: () => void;
  /** «Ещё» подсвечено, когда открыт раздел из его списка. */
  moreActive: boolean;
}) {
  const { tabs, rest } = splitTabs(blocks);
  const showMore = rest.length > 0;

  // only-mobile, а не sm:hidden: утилита Tailwind проигрывает .bbc-tabbar по
  // каскаду слоёв, и бар висел на десктопе поверх ленты вкладок.
  return (
    <nav className="bbc-tabbar only-mobile" aria-label="Разделы">
      {tabs.map((item) => {
        const Icon = item.icon;
        const active = activeKey === item.key;
        const badge = item.key === "warnings" ? warningCount : 0;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onSelect(item.key)}
            aria-current={active ? "page" : undefined}
          >
            <span className="relative flex items-center justify-center">
              <Icon size={20} />
              {badge ? (
                <span
                  className="absolute bbc-num flex items-center justify-center rounded-full"
                  style={
                    {
                      top: -4,
                      left: "calc(50% + 5px)",
                      minWidth: 16,
                      height: 16,
                      padding: "0 4px",
                      fontSize: "0.5625rem",
                      background: "var(--accent-rose)",
                      color: "var(--accent-fg)",
                    } as CSSProperties
                  }
                >
                  {badge > 99 ? "99+" : badge}
                </span>
              ) : null}
            </span>
            <span className="bbc-tabbar-label">{item.short}</span>
          </button>
        );
      })}

      {showMore ? (
        <button
          type="button"
          onClick={onMore}
          aria-current={moreActive ? "page" : undefined}
          aria-haspopup="dialog"
        >
          <span className="flex items-center justify-center">
            <MoreIcon size={20} />
          </span>
          <span className="bbc-tabbar-label">Ещё</span>
        </button>
      ) : null}
    </nav>
  );
}
