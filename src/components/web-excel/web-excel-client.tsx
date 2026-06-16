"use client";

import dynamic from "next/dynamic";

// Univer references window/canvas at import time — keep it fully client-side.
const WebExcelWorkbench = dynamic(
  () => import("./web-excel-workbench").then((m) => m.WebExcelWorkbench),
  { ssr: false, loading: () => <div style={{ padding: 24 }}>Загрузка Web-Excel…</div> },
);

export function WebExcelClient() {
  return <WebExcelWorkbench />;
}
