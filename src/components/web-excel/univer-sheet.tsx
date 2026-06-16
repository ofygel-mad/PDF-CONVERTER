"use client";

import { UniverSheetsCorePreset } from "@univerjs/preset-sheets-core";
import UniverPresetSheetsCoreRuRU from "@univerjs/preset-sheets-core/locales/ru-RU";
import { UniverSheetsSortPreset } from "@univerjs/preset-sheets-sort";
import UniverPresetSheetsSortRuRU from "@univerjs/preset-sheets-sort/locales/ru-RU";
import { UniverSheetsFilterPreset } from "@univerjs/preset-sheets-filter";
import UniverPresetSheetsFilterRuRU from "@univerjs/preset-sheets-filter/locales/ru-RU";
import { UniverSheetsConditionalFormattingPreset } from "@univerjs/preset-sheets-conditional-formatting";
import UniverPresetSheetsConditionalFormattingRuRU from "@univerjs/preset-sheets-conditional-formatting/locales/ru-RU";
import { UniverSheetsDataValidationPreset } from "@univerjs/preset-sheets-data-validation";
import UniverPresetSheetsDataValidationRuRU from "@univerjs/preset-sheets-data-validation/locales/ru-RU";
import { UniverSheetsFindReplacePreset } from "@univerjs/preset-sheets-find-replace";
import UniverPresetSheetsFindReplaceRuRU from "@univerjs/preset-sheets-find-replace/locales/ru-RU";
import { createUniver, LocaleType, mergeLocales } from "@univerjs/presets";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

import "@univerjs/preset-sheets-core/lib/index.css";
import "@univerjs/preset-sheets-sort/lib/index.css";
import "@univerjs/preset-sheets-filter/lib/index.css";
import "@univerjs/preset-sheets-conditional-formatting/lib/index.css";
import "@univerjs/preset-sheets-data-validation/lib/index.css";
import "@univerjs/preset-sheets-find-replace/lib/index.css";

export type WebExcelColumn = { key: string; label: string; kind: string };
export type WebExcelRow = Record<string, unknown>;

export type UniverSheetHandle = {
  /** Current grid as a 2D array (row 0 = headers, rows 1.. = data). */
  read: () => (string | number | boolean | null)[][] | null;
};

type Props = { columns: WebExcelColumn[]; rows: WebExcelRow[] };

function buildWorkbookData(columns: WebExcelColumn[], rows: WebExcelRow[]) {
  const cellData: Record<number, Record<number, { v: string | number }>> = {};
  cellData[0] = {};
  columns.forEach((c, j) => { cellData[0][j] = { v: c.label }; });
  rows.forEach((r, i) => {
    cellData[i + 1] = {};
    columns.forEach((c, j) => {
      const val = r[c.key];
      if (val === null || val === undefined || val === "") return;
      cellData[i + 1][j] = { v: typeof val === "number" ? val : String(val) };
    });
  });
  return {
    id: "web-excel",
    name: "Выписка",
    sheetOrder: ["sheet-1"],
    sheets: {
      "sheet-1": {
        id: "sheet-1",
        name: "Выписка",
        cellData,
        rowCount: Math.max(rows.length + 60, 120),
        columnCount: Math.max(columns.length + 8, 16),
        freeze: { startRow: 1, startColumn: 0, ySplit: 1, xSplit: 0 },
      },
    },
  };
}

export const UniverSheet = forwardRef<UniverSheetHandle, Props>(function UniverSheet(
  { columns, rows },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const apiRef = useRef<any>(null);
  const dims = useRef({ rows: rows.length + 1, cols: columns.length });

  useImperativeHandle(ref, () => ({
    read: () => {
      const api = apiRef.current;
      if (!api) return null;
      const sheet = api.getActiveWorkbook()?.getActiveSheet();
      if (!sheet) return null;
      try {
        return sheet.getDataRange().getValues();
      } catch {
        try {
          const { rows: r, cols: c } = dims.current;
          return sheet.getRange(0, 0, r + 60, c).getValues();
        } catch {
          return null;
        }
      }
    },
  }), []);

  useEffect(() => {
    if (!containerRef.current) return;
    const { univerAPI } = createUniver({
      locale: LocaleType.RU_RU,
      locales: {
        [LocaleType.RU_RU]: mergeLocales(
          UniverPresetSheetsCoreRuRU,
          UniverPresetSheetsSortRuRU,
          UniverPresetSheetsFilterRuRU,
          UniverPresetSheetsConditionalFormattingRuRU,
          UniverPresetSheetsDataValidationRuRU,
          UniverPresetSheetsFindReplaceRuRU,
        ),
      },
      presets: [
        UniverSheetsCorePreset({ container: containerRef.current }),
        UniverSheetsSortPreset(),
        UniverSheetsFilterPreset(),
        UniverSheetsConditionalFormattingPreset(),
        UniverSheetsDataValidationPreset(),
        UniverSheetsFindReplacePreset(),
      ],
    });
    apiRef.current = univerAPI;
    univerAPI.createWorkbook(buildWorkbookData(columns, rows));

    return () => {
      try { univerAPI.dispose(); } catch { /* noop */ }
      apiRef.current = null;
    };
    // Mount once; the parent remounts via `key` to load a new statement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} className="h-full w-full" />;
});
