/* BBC Dashboard icons — kept inside the module (not in components/icons.tsx)
   so deleting the feature never touches the shared icon set. Same stroke style:
   24×24 viewBox, 1.6 stroke, round caps, currentColor. */
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Glyph({ size = 16, children, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

/** Bar-chart glyph for the BBC Dashboard entry point. */
export function BbcDashboardIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M4 20V5M4 20h16" />
      <path d="M8.5 20v-6M13 20V8.5M17.5 20v-9" />
    </Glyph>
  );
}

/** Receivables — a coin with a clock hand. */
export function ReceivablesIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l2.5 2" />
    </Glyph>
  );
}

/** Stacked reports (ДДС → ОПиУ → Баланс). */
export function ReportsIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <rect x="4" y="4" width="16" height="5" rx="1.2" />
      <rect x="4" y="11.5" width="16" height="5" rx="1.2" />
      <path d="M4 19h16" />
    </Glyph>
  );
}

/** Analytics — intersecting slices. */
export function AnalyticsIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M12 4a8 8 0 1 0 8 8h-8V4z" />
      <path d="M15.5 4.8A8 8 0 0 1 19.2 8.5" />
    </Glyph>
  );
}

/** Journal — a ledger with lines. */
export function JournalIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4z" />
      <path d="M9 8.5h6M9 12h6M9 15.5h3.5" />
    </Glyph>
  );
}

/** Payment calendar. */
export function CalendarIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <rect x="4" y="5.5" width="16" height="14" rx="2" />
      <path d="M4 10h16M9 3.5v4M15 3.5v4" />
    </Glyph>
  );
}

/** Sales department — an upward trend. */
export function SalesIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M4 16.5 9.5 11l3.5 3.5L20 7" />
      <path d="M15.5 7H20v4.5" />
    </Glyph>
  );
}

/** Warnings — the anomaly block. */
export function WarningIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M12 4.5 21 19.5H3L12 4.5z" />
      <path d="M12 10v4M12 17h.01" />
    </Glyph>
  );
}

/** Roadmap — what arrives once the data does. */
export function RoadmapIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M12 3v18" strokeDasharray="2.5 3" />
      <path d="M12 6h6.5l-1.6 2.2L18.5 10.5H12" />
      <path d="M12 14H5.5l1.6 2.2L5.5 18.5H12" />
    </Glyph>
  );
}

/** Account / personal cabinet. */
export function UserIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </Glyph>
  );
}

/** Sign out. */
export function LogoutIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M14 5h4a1.5 1.5 0 0 1 1.5 1.5v11A1.5 1.5 0 0 1 18 19h-4" />
      <path d="M10 15.5 13.5 12 10 8.5M13.5 12H4" />
    </Glyph>
  );
}

/** Link / referral URL. */
export function LinkIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M10 13.5a3.5 3.5 0 0 0 5 0l3-3a3.54 3.54 0 0 0-5-5l-1.2 1.2" />
      <path d="M14 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.54 3.54 0 0 0 5 5l1.2-1.2" />
    </Glyph>
  );
}

/** Clock — sets a link's expiry. */
export function ClockIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5.2l3.2 1.9" />
    </Glyph>
  );
}

/** Copy to clipboard. */
export function CopyIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M15 6.5A2.5 2.5 0 0 0 12.5 4H6.5A2.5 2.5 0 0 0 4 6.5v6A2.5 2.5 0 0 0 6.5 15" />
    </Glyph>
  );
}

/** Confirmation tick. */
export function CheckIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M5 12.5 9.5 17 19 7" />
    </Glyph>
  );
}

/** Lock — the login screen. */
export function LockIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <rect x="4.5" y="10" width="15" height="10" rx="2" />
      <path d="M8 10V7.5a4 4 0 0 1 8 0V10" />
    </Glyph>
  );
}

/** Sliders — the control panel tab. */
export function ControlPanelIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="17" r="2" />
    </Glyph>
  );
}

/**
 * Лупа для кнопки поиска.
 *
 * Раньше на её месте стоял символ `⌘`: на Windows в шрифте без этой глифы он
 * рисуется прямоугольником-заменителем и читается как случайный знак, а не как
 * клавиша. Сочетание клавиш теперь подписано словами и уходит вправо.
 */
export function SearchIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m15.8 15.8 4 4" />
    </Glyph>
  );
}

/** Right arrow — «К данным →». */
export function ArrowRightIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </Glyph>
  );
}

/** Шеврон — раскрытие строки клиента в реестре дебиторки. */
export function ChevronRightIcon(props: IconProps) {
  return (
    <Glyph size={14} {...props}>
      <path d="M9 6l6 6-6 6" />
    </Glyph>
  );
}

/** Круговая диаграмма — вход в «Итоги» дебиторки. */
export function PieChartIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M12 3v9h9" />
      <circle cx="12" cy="12" r="9" />
    </Glyph>
  );
}

/** Три точки — вход в лист действий на телефоне. */
export function MoreIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </Glyph>
  );
}

/**
 * Точка справки. Заменяет `title=` там, где в подсказке лежат данные:
 * на сенсорном экране `title` не срабатывает никогда.
 */
export function InfoIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5" />
      <circle cx="12" cy="7.9" r="0.9" fill="currentColor" stroke="none" />
    </Glyph>
  );
}

/** Ползунки — «Настроить» из строки контекста. */
export function SlidersIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="17" r="2" />
    </Glyph>
  );
}

/**
 * Журнал касаний — реплика разговора.
 *
 * Отличается от JournalIcon (журнал операций) намеренно: там строки документа,
 * здесь обращение к человеку. Два раздела рядом в меню, и по одной иконке
 * должно быть понятно, в какой из них попадёшь.
 */
export function TouchesIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M20 14a2 2 0 0 1-2 2H8l-4 3.5V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z" />
      <path d="M8.5 9.5h7M8.5 12.5h4" />
    </Glyph>
  );
}

/** Скрепка — приложить скрин или документ к касанию. */
export function PaperclipIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M20 11.5l-7.6 7.6a4.6 4.6 0 0 1-6.5-6.5l7.9-7.9a3 3 0 1 1 4.3 4.3l-7.9 7.9a1.5 1.5 0 0 1-2.1-2.1l7.2-7.2" />
    </Glyph>
  );
}

/** Бургер — вход в меню разделов на телефоне. */
export function MenuIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Glyph>
  );
}
