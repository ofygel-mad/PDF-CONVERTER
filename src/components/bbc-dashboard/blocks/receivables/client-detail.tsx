"use client";

/**
 * Раскрытие клиента: из чего сложился его долг.
 *
 * Две группировки, потому что вопрос бывает двух видов. «Отдел → договор» —
 * когда разбираются, чей это долг и с кого спрашивать. «Договор → отдел» —
 * когда один договор ведут несколько отделов и нужно понять, где он застрял.
 */
import { useState } from "react";

import { dateLabel, money, plural } from "../../format";
import { department } from "../../department";
import type { BbcRow } from "../../types";
import { AgeLabel, ageOfRow } from "./age-track";
import { rowDebt, type ClientDebt } from "./debt";

type GroupBy = "dept" | "contract";

/** «НО · Налоговый отдел». Незнакомый код показываем как есть, не выдумывая. */
function departmentLabel(code: string): string {
  const info = department(code);
  if (!info || info.name === `Отдел ${code}`) return code;
  return `${code} · ${info.name}`;
}

export function ClientDetail({ client }: { client: ClientDebt }) {
  const [groupBy, setGroupBy] = useState<GroupBy>("dept");

  const groups = new Map<string, BbcRow[]>();
  for (const row of client.rows) {
    // Строка может числиться за несколькими отделами сразу — тогда она честно
    // попадает в каждый. Делить её сумму между ними было бы выдумкой.
    const keys =
      groupBy === "dept"
        ? row.departments.length
          ? row.departments
          : ["Без отдела"]
        : [row.contract_no || "Без договора"];
    for (const key of keys) {
      const bucket = groups.get(key);
      if (bucket) bucket.push(row);
      else groups.set(key, [row]);
    }
  }

  const ordered = [...groups.entries()]
    .map(([name, rows]) => ({
      name,
      rows,
      debt: rows.reduce((sum, row) => sum + rowDebt(row), 0),
    }))
    .sort((a, b) => b.debt - a.debt);

  return (
    <div
      className="px-3 pb-3 pt-1 flex flex-col gap-2"
      style={{ background: "var(--bg-base)" }}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          <GroupTab active={groupBy === "dept"} onClick={() => setGroupBy("dept")}>
            Отдел → договор
          </GroupTab>
          <GroupTab active={groupBy === "contract"} onClick={() => setGroupBy("contract")}>
            Договор → отдел
          </GroupTab>
        </div>
        {client.pending > 0 ? (
          <span className="text-xs bbc-num" style={{ color: "var(--text-muted)" }}>
            предстоит {money(client.pending)} ₸ — срок ещё не наступил
          </span>
        ) : null}
      </div>

      {ordered.map((group) => (
        <div key={group.name} className="card-inner overflow-hidden">
          <div
            className="flex items-center justify-between gap-2 px-3 py-1.5"
            style={{ borderBottom: "1px solid var(--border-subtle)" }}
          >
            <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
              {groupBy === "dept" ? departmentLabel(group.name) : group.name}
            </span>
            <span className="text-xs font-semibold bbc-num">{money(group.debt)} ₸</span>
          </div>

          <div className="bbc-scroll-x">
            <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {[
                    groupBy === "dept" ? "Договор" : "Отдел",
                    "Период",
                    "Ответственный",
                    "Юрлицо",
                    "Счёт",
                    "Возраст",
                    "Долг",
                  ].map((label, index) => (
                    <th
                      key={label}
                      data-optional={index >= 2 && index <= 4 ? "" : undefined}
                      className={`font-medium px-2 py-1 whitespace-nowrap ${
                        label === "Долг" || label === "Возраст" ? "text-right" : "text-left"
                      }`}
                      style={{
                        color: "var(--text-muted)",
                        borderBottom: "1px solid var(--border-subtle)",
                      }}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {group.rows
                  .slice()
                  .sort((a, b) => rowDebt(b) - rowDebt(a))
                  .map((row) => (
                    <DetailRow key={row.index} row={row} groupBy={groupBy} />
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

function DetailRow({ row, groupBy }: { row: BbcRow; groupBy: GroupBy }) {
  const debt = rowDebt(row);
  const age = ageOfRow(row);

  return (
    <tr>
      <td className="px-2 py-1" style={{ color: "var(--text-secondary)" }}>
        {groupBy === "dept"
          ? row.contract_no || "—"
          : row.departments.join(", ") || "без отдела"}
        {row.carry_in ? (
          <span className="ml-1.5" style={{ color: "var(--text-muted)" }}>
            вкл. {money(row.carry_in)} ₸ прошлых периодов
          </span>
        ) : null}
      </td>
      <td className="px-2 py-1 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
        {row.period_label || (row.period_start ? dateLabel(row.period_start) : "—")}
      </td>
      <td data-optional className="px-2 py-1" style={{ color: "var(--text-secondary)" }}>
        {row.employee || "—"}
      </td>
      <td data-optional className="px-2 py-1" style={{ color: "var(--text-muted)" }}>
        {row.firm}
      </td>
      <td data-optional className="px-2 py-1" style={{ color: "var(--text-secondary)" }}>
        {row.invoiced ? row.invoice_no || "выставлен" : "—"}
      </td>
      <td className="px-2 py-1 text-right">
        {row.debt_pending ? (
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            срок не наступил
          </span>
        ) : (
          <AgeLabel days={age} />
        )}
      </td>
      <td className="px-2 py-1 text-right bbc-num font-medium">
        {row.debt_broken ? (
          <span title="В книге ошибка формулы — долг не посчитан" style={{ color: "var(--accent-rose)" }}>
            не посчитан
          </span>
        ) : row.debt_pending ? (
          <span style={{ color: "var(--text-muted)" }}>
            {money(row.contract_amount)} ₸
          </span>
        ) : (
          `${money(debt)} ₸`
        )}
      </td>
    </tr>
  );
}

function GroupTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`px-2.5 py-1 rounded-[var(--radius-btn)] text-xs ${
        active ? "tab-active" : "tab-inactive"
      }`}
      onClick={onClick}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

export function contractCountLabel(client: ClientDebt): string {
  const count = client.contracts.length;
  return `${count} ${plural(count, "договор", "договора", "договоров")}`;
}
