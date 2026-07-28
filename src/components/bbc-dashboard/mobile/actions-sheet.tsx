"use client";

/**
 * Лист действий — всё, что на десктопе стоит кнопками в правом углу шапки.
 *
 * На телефоне шапка ужата до одной строки, и семь иконок в неё не помещаются.
 * Заодно решается давняя проблема: причина остывания кнопки «Обновить» жила
 * в `title`, а он на сенсорном экране не срабатывает. Здесь она — видимая
 * подпись под строкой.
 *
 * Тумблера плотности тут нет. Ниже `sm` таблиц уже нет (их заменяют карточки),
 * а двухколоночная раскладка блоков включается только с 1280px — то есть от
 * него остался бы один отступ в карточках. Кнопка, которая на вид ничего не
 * делает, читается как поломка.
 */
import type { ReactNode } from "react";

import { ArrowLeftIcon, RefreshIcon } from "@/components/icons";
import { SearchIcon, UserIcon } from "../icon";
import { BottomSheet } from "./bottom-sheet";

export function ActionsSheet({
  open,
  onClose,
  loading,
  refreshCooldown,
  onRefresh,
  onSearch,
  isAdmin,
  onAccount,
  onServices,
}: {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  refreshCooldown: number;
  onRefresh: () => void;
  onSearch: () => void;
  isAdmin: boolean;
  onAccount: () => void;
  onServices: () => void;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Действия">
      <div className="bbc-glist pb-2">
        <ActionRow
          icon={<RefreshIcon size={18} />}
          label={loading ? "Обновление…" : "Обновить таблицу"}
          // Раньше это объяснение было в `title` и на телефоне не доставалось.
          note={
            refreshCooldown > 0
              ? `Только что читали таблицу. Следующее ручное чтение через ${refreshCooldown} с — фоновое обновление идёт само каждые 15 секунд.`
              : "Перечитать Google-таблицу сейчас"
          }
          disabled={loading || refreshCooldown > 0}
          onClick={onRefresh}
        />
        <ActionRow
          icon={<SearchIcon size={18} />}
          label="Поиск"
          note="Разделы, режимы, клиенты, отделы, сотрудники"
          onClick={onSearch}
        />
        {isAdmin ? (
          <ActionRow
            icon={<UserIcon size={18} />}
            label="Личный кабинет"
            note="Ссылки отделов и доступы"
            onClick={onAccount}
          />
        ) : null}
        <ActionRow
          icon={<ArrowLeftIcon size={18} />}
          label="К сервисам"
          note="Остальные инструменты"
          onClick={onServices}
        />
      </div>
    </BottomSheet>
  );
}

function ActionRow({
  icon,
  label,
  note,
  disabled,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  note?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-start gap-3 text-left py-2.5"
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      <span className="shrink-0 mt-0.5" style={{ color: "var(--text-muted)" }}>
        {icon}
      </span>
      <span className="min-w-0">
        <span
          className="block"
          style={{ fontSize: "var(--ios-value)", color: "var(--text-primary)" }}
        >
          {label}
        </span>
        {note ? (
          <span className="block text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            {note}
          </span>
        ) : null}
      </span>
    </button>
  );
}
