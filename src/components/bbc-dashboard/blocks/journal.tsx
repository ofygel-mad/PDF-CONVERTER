"use client";

/**
 * Блок 4 — Журнал операций.
 *
 * Слева таблица операций, справа конструктор мини-сводок: выбираешь измерение
 * и меру — получаешь свод рядом с исходными строками.
 *
 * Честность про полноту: в листе 5958 строк, но содержательных 1390 — остальные
 * технические, и считать проценты от них бессмысленно. Среди содержательных дата,
 * контрагент, фирма и счёт заполнены полностью, а категория лишь у трети. Поэтому
 * каждый свод показывает своё покрытие и сумму, которая в него не попала.
 */
import { useCallback, useEffect, useMemo, useState } from "react";

import { BbcApiError, fetchJournal } from "../api";
import { dateLabel, money, moneyShort, percent, plural } from "../format";
import { SpecList, type FieldSpec } from "../mobile/card-list";
import type { BbcJournalPayload, BbcJournalRow } from "../types";
import { SectionCard } from "./shared";

const PAGE = 100;

export function JournalBlock() {
  const [payload, setPayload] = useState<BbcJournalPayload | null>(null);
  const [group, setGroup] = useState("counterparty");
  const [measure, setMeasure] = useState("outflow");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (nextGroup: string, nextMeasure: string) => {
    setLoading(true);
    try {
      setPayload(await fetchJournal(nextGroup, nextMeasure));
      setError(null);
    } catch (err) {
      setError(err instanceof BbcApiError ? err.message : "Не удалось загрузить журнал");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(group, measure);
  }, [load, group, measure]);

  const rows = useMemo(() => {
    if (!payload) return [];
    if (!search) return payload.rows;
    const needle = search.toLowerCase();
    return payload.rows.filter((row) =>
      `${row.counterparty} ${row.firm} ${row.account} ${row.category} ${row.comment}`
        .toLowerCase()
        .includes(needle),
    );
  }, [payload, search]);

  if (error) {
    return (
      <SectionCard title="Журнал операций" subtitle="Не удалось загрузить">
        <p className="text-xs" style={{ color: "var(--accent-rose)" }}>
          {error}
        </p>
      </SectionCard>
    );
  }

  if (!payload) {
    return (
      <SectionCard title="Журнал операций" subtitle="Читаем журнал…">
        <p className="mono-meta">Загрузка…</p>
      </SectionCard>
    );
  }

  const { coverage } = payload;

  return (
    <div className="flex flex-col gap-4">
      <SectionCard
        title="Обороты по журналу"
        subtitle="Только содержательные строки: те, где есть дата или сумма."
      >
        <div className="grid gap-2.5 grid-cols-2 sm:grid-cols-4">
          <Tile label="Операций" value={coverage.rows.toLocaleString("ru-RU")} />
          <Tile label="Приход" value={moneyShort(coverage.inflow)} tone="var(--accent-emerald)" />
          <Tile label="Расход" value={moneyShort(coverage.outflow)} tone="var(--accent-rose)" />
          <Tile
            label="Сальдо"
            value={moneyShort(coverage.net)}
            tone={coverage.net >= 0 ? "var(--accent-emerald)" : "var(--accent-rose)"}
          />
        </div>

        <div className="flex flex-wrap gap-3 mt-4">
          <Coverage label="Дата" share={coverage.with_date} />
          <Coverage label="Контрагент" share={coverage.with_counterparty} />
          <Coverage label="Фирма" share={coverage.with_firm} />
          <Coverage label="Счёт" share={coverage.with_account} />
          <Coverage label="Категория" share={coverage.with_category} />
          <Coverage label="Подкатегория" share={coverage.with_subcategory} />
        </div>
      </SectionCard>

      <SectionCard
        title="Мини-сводка"
        subtitle="Выберите измерение и меру — свод считается по тем же строкам, что в таблице ниже."
      >
        <div className="flex flex-col gap-2 mb-4">
          <div className="flex flex-wrap gap-1.5">
            {payload.groups.map((item) => (
              <Chip
                key={item.key}
                active={group === item.key}
                onClick={() => setGroup(item.key)}
                disabled={loading}
              >
                {item.title}
              </Chip>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {payload.measures.map((item) => (
              <Chip
                key={item.key}
                active={measure === item.key}
                onClick={() => setMeasure(item.key)}
                disabled={loading}
              >
                {item.title}
              </Chip>
            ))}
          </div>
        </div>

        {payload.summary.coverage < 0.99 ? (
          <div
            className="card-inner p-3 text-xs mb-3"
            style={{ color: "var(--text-secondary)" }}
          >
            <p style={{ color: "var(--accent-amber)" }}>
              Свод покрывает {percent(payload.summary.coverage)} операций
            </p>
            У {payload.summary.missing_rows}{" "}
            {plural(payload.summary.missing_rows, "строки", "строк", "строк")} измерение
            «{payload.summary.group_title.toLowerCase()}» не заполнено — это{" "}
            {money(payload.summary.missing_value)} ₸, которые в свод не попали.
          </div>
        ) : null}

        {payload.summary.items.length ? (
          <div className="flex flex-col gap-2.5">
            {payload.summary.items.map((item, index) => (
              <div key={item.key}>
                <div className="flex items-baseline justify-between gap-3 mb-1">
                  <span
                    className="text-xs truncate"
                    style={{ color: "var(--text-secondary)" }}
                    title={item.key}
                  >
                    {item.key}
                    <span className="mono-meta ml-2">{item.count} оп.</span>
                  </span>
                  <span className="text-xs bbc-num shrink-0" style={{ color: "var(--text-primary)" }}>
                    {money(item.value)}
                  </span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-active)" }}>
                  <div
                    className="h-full rounded-full bbc-grow"
                    style={{
                      width: `${
                        (Math.abs(item.value) /
                          Math.max(...payload.summary.items.map((entry) => Math.abs(entry.value)), 1)) *
                        100
                      }%`,
                      background: item.value < 0 ? "var(--accent-rose)" : "var(--accent)",
                      transformOrigin: "left",
                      transition: "width var(--dur-tell) var(--ease-out)",
                      animationDelay: `calc(${index} * var(--dur-stagger))`,
                    }}
                  />
                </div>
              </div>
            ))}
            <p className="mono-meta mt-1">
              итого {money(payload.summary.total)}
              {payload.summary.truncated ? " · показаны крупнейшие" : ""}
            </p>
          </div>
        ) : (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            По этому измерению данных нет.
          </p>
        )}
      </SectionCard>

      <SectionCard
        title="Операции"
        subtitle="Исходные строки журнала — гарантия, что ничего не скрыто."
        action={
          <input
            className="input-field text-xs w-full sm:max-w-[220px]"
            placeholder="Контрагент, фирма, счёт…"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setLimit(PAGE);
            }}
            aria-label="Поиск по журналу"
          />
        }
      >
        <JournalTable rows={rows.slice(0, limit)} />
        {rows.length > limit ? (
          <button
            type="button"
            className="btn-ghost text-xs px-3 py-1.5 mt-3"
            onClick={() => setLimit((value) => value + PAGE)}
          >
            Показать ещё — {rows.length - limit} из {rows.length}
          </button>
        ) : (
          <p className="mono-meta mt-2">показано {rows.length}</p>
        )}
      </SectionCard>
    </div>
  );
}

/**
 * Колонки журнала — тем же описанием, что и реестр.
 *
 * Контрагент становится заголовком карточки, дата и фирма — подписью под ним.
 * Номер строки, счёт и категория помечены `optional`: на десктопе в компактном
 * режиме они уходят, на телефоне прячутся под раскрытие.
 */
const JOURNAL_COLUMNS: FieldSpec<BbcJournalRow, null>[] = [
  {
    key: "index",
    header: "№",
    optional: true,
    cellClass: "mono-meta",
    render: (row) => row.index,
  },
  {
    key: "at",
    header: "Дата",
    secondary: true,
    cellClass: "mono-meta whitespace-nowrap",
    render: (row) => dateLabel(row.at),
  },
  {
    key: "counterparty",
    header: "Контрагент",
    primary: true,
    cellClass: "max-w-[200px] truncate",
    tone: "var(--text-primary)",
    hint: (row) => row.counterparty || undefined,
    render: (row) => row.counterparty || "—",
  },
  {
    key: "firm",
    header: "Фирма",
    secondary: true,
    cellClass: "max-w-[160px] truncate",
    hint: (row) => row.firm || undefined,
    render: (row) => row.firm || "—",
  },
  {
    key: "account",
    header: "Счёт",
    optional: true,
    cellClass: "max-w-[160px] truncate",
    hint: (row) => row.account || undefined,
    render: (row) => row.account || "—",
  },
  {
    key: "category",
    header: "Категория",
    optional: true,
    tone: (row) => (row.category ? "var(--text-secondary)" : "var(--text-muted)"),
    render: (row) => row.category || "не задана",
  },
  {
    key: "inflow",
    header: "Приход",
    align: "right",
    cellClass: "text-right bbc-num",
    tone: "var(--accent-emerald)",
    render: (row) => (row.inflow ? money(row.inflow) : "—"),
  },
  {
    key: "outflow",
    header: "Расход",
    align: "right",
    cellClass: "text-right bbc-num",
    tone: "var(--accent-rose)",
    render: (row) => (row.outflow ? money(row.outflow) : "—"),
  },
];

function JournalTable({ rows }: { rows: BbcJournalRow[] }) {
  return (
    <SpecList
      columns={JOURNAL_COLUMNS}
      rows={rows}
      ctx={null}
      rowKey={(row) => row.index}
      // Постранично листает сам блок — здесь ограничивать второй раз нечего.
      limit={rows.length}
      mobileLimit={rows.length}
      rowClassName={(row) => (row.inflow ? "row-inflow" : row.outflow ? "row-outflow" : undefined)}
      empty="Ничего не найдено."
    />
  );
}

function Chip({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="text-xs px-2.5 py-1.5 rounded-lg"
      style={{
        background: active ? "var(--accent-soft)" : "var(--bg-active)",
        border: `1px solid ${active ? "var(--accent-line)" : "transparent"}`,
        color: active ? "var(--text-accent)" : "var(--text-secondary)",
        transition: "background var(--dur-fast)",
      }}
    >
      {children}
    </button>
  );
}

function Coverage({ label, share }: { label: string; share: number }) {
  const tone =
    share >= 0.9 ? "var(--accent-emerald)" : share >= 0.5 ? "var(--accent-amber)" : "var(--accent-rose)";
  return (
    <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
      <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: tone }} />
      {label}
      <span className="bbc-num" style={{ color: tone }}>
        {Math.round(share * 100)}%
      </span>
    </span>
  );
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="card-inner p-3">
      <p className="eyebrow mb-1 truncate">{label}</p>
      <p className="text-base font-semibold bbc-num" style={{ color: tone ?? "var(--text-primary)" }}>
        {value}
      </p>
    </div>
  );
}
