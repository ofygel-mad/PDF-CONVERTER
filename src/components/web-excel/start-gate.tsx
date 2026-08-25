"use client";

import { useState } from "react";

import { GridIcon, TableIcon } from "@/components/icons";

export type GateChoice = "blank" | "import";

/** Ключ выбора «запомнить». Читается до первого кадра — см. `readSavedChoice`. */
const STORAGE_KEY = "webexcel.start-choice";

export function readSavedChoice(): GateChoice | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "blank" || value === "import" ? value : null;
  } catch {
    return null;
  }
}

export function forgetSavedChoice() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* приватный режим — выбор просто не запоминался */
  }
}

function rememberChoice(choice: GateChoice) {
  try {
    localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    /* приватный режим — спросим в следующий раз */
  }
}

type Props = { onChoose: (choice: GateChoice) => void };

/**
 * Две плитки поверх затемнённой таблицы: с чего начать работу.
 *
 * Затемняется и размывается настоящая пустая таблица, а не картинка — так
 * видно, куда именно приведёт любой из двух ответов, и экран не выглядит
 * модальным окном, висящим в пустоте.
 */
export function StartGate({ onChoose }: Props) {
  const [remember, setRemember] = useState(false);

  const choose = (choice: GateChoice) => {
    if (remember) rememberChoice(choice);
    onChoose(choice);
  };

  return (
    <div className="we-gate" role="dialog" aria-modal="true" aria-label="С чего начать">
      <div className="we-gate-cards">
        <button type="button" className="we-gate-card" onClick={() => choose("blank")}>
          <span className="we-gate-icon">
            <TableIcon size={22} />
          </span>
          <span className="we-gate-title">Новая таблица</span>
          <span className="we-gate-hint">
            Пустая книга с нуля — формулы, форматы и листы как в Excel
          </span>
        </button>

        <button type="button" className="we-gate-card" onClick={() => choose("import")}>
          <span className="we-gate-icon">
            <GridIcon size={22} />
          </span>
          <span className="we-gate-title">Продолжить в импортированной таблице</span>
          <span className="we-gate-hint">
            Книги BBC из Google Sheets — с их оформлением, объединениями и форматами
          </span>
        </button>
      </div>

      <label className="we-gate-remember">
        <input
          type="checkbox"
          checked={remember}
          onChange={(event) => setRemember(event.target.checked)}
        />
        <span>Сохранить мой выбор</span>
      </label>
    </div>
  );
}
