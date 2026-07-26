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
