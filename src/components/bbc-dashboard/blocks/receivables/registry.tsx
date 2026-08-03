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
import { ChevronRightIcon, TouchesIcon } from "../../icon";
import { AgeLabel, AgeTrack } from "./age-track";
import { ClientDetail } from "./client-detail";
import type { ClientDebt } from "./debt";

export function Registry({
  clients,
  expanded,
  onToggle,
  showDepartments,
  touchCounts,
  onOpenTouches,
}: {
  clients: ClientDebt[];
  expanded: Set<string>;
  onToggle: (key: string) => void;
  /** У начальника одного отдела колонка повторяет один и тот же код в каждой
   *  строке — это ровно тот шум, ради которого блок и переделывали. */
  showDepartments: boolean;
  /** Ключ клиента → сколько по нему касаний. Отдельный лёгкий запрос. */
  touchCounts?: Record<string, number>;
  /** Провалиться в журнал касаний по этому должнику. */
  onOpenTouches?: (client: string) => void;
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
            touches={touchCounts?.[client.key] ?? 0}
            onOpenTouches={onOpenTouches}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Строка реестра.
 *
 * Строка — <div>, а не <button>, потому что действий в ней два: раскрыть и
 * провалиться в журнал касаний. Кнопку в кнопку вложить нельзя, а обычный
 * onClick на div не берётся с клавиатуры. Поэтому раскрытие висит на кнопке с
 * именем клиента, растянутой по всей строке через `::after { inset: 0 }`
 * (`.bbc-reg-open` в globals.css), а кнопка касаний лежит поверх собственным
 * слоем. Обе настоящие, обе в порядке табуляции.
 */
function ClientRow({
  client,
  open,
  onToggle,
  showDepartments,
  touches,
  onOpenTouches,
}: {
  client: ClientDebt;
  open: boolean;
  onToggle: () => void;
  showDepartments: boolean;
  touches: number;
  onOpenTouches?: (client: string) => void;
}) {
  return (
    <div style={{ borderBottom: "1px solid var(--border-subtle)" }}>
      <div className="bbc-reg-row" data-no-dept={showDepartments ? undefined : ""}>
        <button
          type="button"
          className="bbc-reg-open bbc-reg-name flex items-center gap-2 min-w-0 text-left"
          onClick={onToggle}
          aria-expanded={open}
        >
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
        </button>

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

        {onOpenTouches ? (
          <button
            type="button"
            className="bbc-reg-touch"
            onClick={() => onOpenTouches(client.client)}
            title={`Работа с долгом «${client.client}»`}
          >
            <TouchesIcon size={13} />
            {/* Число, а не значок: «сколько раз уже писали» — это и есть ответ,
                ради которого сюда смотрят. Ноль сказан словом, чтобы пустая
                история читалась как приглашение, а не как сбой. */}
            {touches > 0 ? (
              <span className="bbc-num">
                {touches} {plural(touches, "касание", "касания", "касаний")}
              </span>
            ) : (
              <span>Работа с долгом</span>
            )}
          </button>
        ) : null}
      </div>

      {open ? <ClientDetail client={client} /> : null}
    </div>
  );
}
