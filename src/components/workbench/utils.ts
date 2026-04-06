export function formatValue(value: string | number | null | undefined, kind = "text") {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (kind === "currency" && typeof value === "number") {
    return new Intl.NumberFormat("ru-RU", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  return String(value);
}

export function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function severityClassName(severity: string) {
  if (severity === "high")   return "badge-rose";
  if (severity === "medium") return "badge-amber";
  return "badge-blue";
}
