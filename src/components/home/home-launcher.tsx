"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { ClockIcon, GridIcon, PuzzleIcon, TableIcon } from "@/components/icons";
import { useThemeMode } from "./use-theme-mode";

/**
 * Стартовый экран: четыре плитки, слетающиеся из углов на фоне видео.
 *
 * Адреса роликов приходят из окружения, а не лежат в репозитории: видео
 * заливается в Cloudflare, и коммитить десятки мегабайт в git ради фона
 * значит навсегда утяжелить каждый клон. Пока переменных нет, фон — тот же
 * градиент `--page-bg`, что и на остальных экранах, и стартовая страница
 * выглядит законченной, а не сломанной.
 */
const VIDEO_DARK = process.env.NEXT_PUBLIC_HOME_VIDEO_DARK ?? "";
const VIDEO_LIGHT = process.env.NEXT_PUBLIC_HOME_VIDEO_LIGHT ?? "";

type Tile = {
  href: string;
  label: string;
  hint: string;
  corner: "tl" | "tr" | "bl" | "br";
  Icon: typeof TableIcon;
};

const TILES: Tile[] = [
  {
    href: "/analyzer",
    label: "Анализатор выписок",
    hint: "PDF, скан или Excel — в разобранную таблицу",
    corner: "tl",
    Icon: TableIcon,
  },
  {
    href: "/services",
    label: "Сервисы",
    hint: "Autocall.kz, интеграции и выгрузки",
    corner: "tr",
    Icon: PuzzleIcon,
  },
  {
    href: "/web-excel",
    label: "Таблицы",
    hint: "Книги BBC целиком — в том же виде, что в Google",
    corner: "bl",
    Icon: GridIcon,
  },
  {
    href: "/history",
    label: "История",
    hint: "Разобранные выписки прошлых сессий",
    corner: "br",
    Icon: ClockIcon,
  },
];

export function HomeLauncher() {
  const theme = useThemeMode();
  const videoRef = useRef<HTMLVideoElement>(null);
  const src = theme === "light" ? VIDEO_LIGHT : VIDEO_DARK;

  // Смена темы меняет src, но <video> не перезапускается сам от смены
  // атрибута — без явного load() остаётся висеть последний кадр прежнего
  // ролика, и «видео под светлую тему» оказывается тёмным стоп-кадром.
  useEffect(() => {
    const node = videoRef.current;
    if (!node || !src) return;
    node.load();
    void node.play().catch(() => {
      /* автозапуск может быть запрещён политикой браузера — фон просто статичен */
    });
  }, [src]);

  return (
    <div className="home-stage">
      {src ? (
        <video
          ref={videoRef}
          className="home-video"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
          tabIndex={-1}
        >
          <source src={src} />
        </video>
      ) : null}
      <div className="home-veil" aria-hidden="true" />

      {/* В шапке стартового экрана только переключатель темы. Значок и подпись
          «BBC Consulting» отсюда убраны: разделы — четыре плитки посреди
          экрана, и всё, что стоит вокруг них, соревнуется с ними за внимание,
          ничего при этом не сообщая. */}
      <header className="home-top">
        <HomeThemeToggle />
      </header>

      <main className="home-grid">
        {TILES.map((tile, index) => (
          <Link
            key={tile.href}
            href={tile.href}
            className="home-tile"
            data-corner={tile.corner}
            style={{ animationDelay: `calc(var(--home-delay) + ${index * 60}ms)` }}
          >
            <span className="home-tile-icon">
              <tile.Icon size={22} />
            </span>
            <span className="home-tile-label">{tile.label}</span>
            <span className="home-tile-hint">{tile.hint}</span>
          </Link>
        ))}
      </main>
    </div>
  );
}

/**
 * Переключатель темы на стартовом экране.
 *
 * Копия того, что стоит в шапке анализатора, а не общий компонент — намеренно:
 * тот живёт внутри WorkbenchProvider и тянет за собой весь контекст разбора
 * выписок, которому на стартовом экране делать нечего.
 */
function HomeThemeToggle() {
  const [label, setLabel] = useState("Авто");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("theme");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLabel(stored === "dark" ? "Тёмная" : stored === "light" ? "Светлая" : "Авто");
    } catch {
      /* приватный режим — остаётся «Авто» */
    }
  }, []);

  const cycle = () => {
    try {
      const stored = localStorage.getItem("theme");
      const next = stored === "dark" ? "light" : stored === "light" ? null : "dark";
      if (next === null) {
        localStorage.removeItem("theme");
        const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
        setLabel("Авто");
      } else {
        localStorage.setItem("theme", next);
        document.documentElement.setAttribute("data-theme", next);
        setLabel(next === "dark" ? "Тёмная" : "Светлая");
      }
    } catch {
      /* приватный режим — тема не запоминается */
    }
  };

  return (
    <button type="button" className="btn-ghost text-xs px-2.5 py-1.5" onClick={cycle}>
      {label}
    </button>
  );
}
