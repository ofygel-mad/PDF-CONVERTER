"use client";

/**
 * Реестр клиентов — главный экран дебиторки.
 *
 * Отвечает на вопрос, ради которого блок открывают каждый день: кто сколько
 * должен. Всё остальное — раскрытием и в «Итогах».
 *
 * Раскладка одна на все ширины: сетка из четырёх колонок на десктопе
 * складывается в две строки на телефоне обычными адаптивными классами. Ни один
 * элемент не прячется утилитой `hidden` поверх класса из globals.css — по
 * каскаду неслоёный стиль перебил бы её молча.
 */
import { money, plural } from "../../format";
import { ChevronRightIcon } from "../../icon";
import { AgeLabel, AgeTrack } from "./age-track";
import { ClientDetail } from "./client-detail";
import type { ClientDebt } from "./debt";

export function Registry({
  clients,
  expanded,
  onToggle,
  showDepartments,
}: {
  clients: ClientDebt[];
  expanded: Set<string>;
  onToggle: (key: string) => void;
  /** У начальника одного отдела колонка повторяет один и тот же код в каждой
   *  строке — это ровно тот шум, ради которого блок и переделывали. */
  showDepartments: boolean;
}) {
  if (!clients.length) {
    return (
      <div className="card p-8 text-center text-sm" style={{ color: "var(--text-secondary)" }}>
        Под фильтры не попал ни один клиент.
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      {/* Шапка таблицы. На телефоне она не нужна: там каждая строка сама
          подписывает свои значения. */}
      <div
        className="bbc-reg-head only-desktop"
        data-no-dept={showDepartments ? undefined : ""}
        style={{ borderBottom: "1px solid var(--border-base)" }}
      >
        <span className="eyebrow">Клиент</span>
        <span className="eyebrow">Возраст долга</span>
        {showDepartments ? <span className="eyebrow">Отделы</span> : null}
        <span className="eyebrow text-right">Долг</span>
      </div>

      <div>
        {clients.map((client) => (
          <ClientRow
            key={client.key}
            client={client}
            open={expanded.has(client.key)}
            onToggle={() => onToggle(client.key)}
            showDepartments={showDepartments}
          />
        ))}
      </div>
    </div>
  );
}

function ClientRow({
  client,
  open,
  onToggle,
  showDepartments,
}: {
  client: ClientDebt;
  open: boolean;
  onToggle: () => void;
  showDepartments: boolean;
}) {
  return (
    <div style={{ borderBottom: "1px solid var(--border-subtle)" }}>
      <button
        type="button"
        className="bbc-reg-row w-full text-left"
        data-no-dept={showDepartments ? undefined : ""}
        onClick={onToggle}
        aria-expanded={open}
      >
        <span className="bbc-reg-name flex items-center gap-2 min-w-0">
          <span
            className="shrink-0 transition-transform"
            style={{
              color: "var(--text-muted)",
              transform: open ? "rotate(90deg)" : "none",
              transitionDuration: "var(--dur-fast)",
            }}
          >
            <ChevronRightIcon />
          </span>
          <span className="min-w-0">
            <span
              className="block text-sm font-medium truncate"
              style={{ color: "var(--text-primary)" }}
            >
              {client.client}
            </span>
            <span className="block text-xs truncate" style={{ color: "var(--text-muted)" }}>
              {client.contracts.length}{" "}
              {plural(client.contracts.length, "договор", "договора", "договоров")}
              {client.parked > 0 ? ` · не в силе ${money(client.parked)} ₸` : ""}
              {client.broken ? " · долг посчитан не полностью" : ""}
            </span>
          </span>
        </span>

        <span className="bbc-reg-age flex items-center gap-2">
          <AgeTrack rows={client.rows} />
          <AgeLabel days={client.ageDays} />
        </span>

        {showDepartments ? (
          <span
            className="bbc-reg-dept text-xs truncate"
            style={{ color: "var(--text-secondary)" }}
          >
            {client.departments.join(", ") || "—"}
          </span>
        ) : null}

        <span className="bbc-reg-sum text-right">
          <span
            className="block text-sm font-semibold bbc-num"
            style={{ color: "var(--text-primary)" }}
          >
            {money(client.debt)} ₸
          </span>
          {client.pending > 0 ? (
            <span className="block text-xs bbc-num" style={{ color: "var(--text-muted)" }}>
              предстоит {money(client.pending)}
            </span>
          ) : null}
        </span>
      </button>

      {open ? <ClientDetail client={client} /> : null}
    </div>
  );
}
