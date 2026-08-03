"use client";

/**
 * Принудительная смена пароля при первом входе.
 *
 * Показывается вместо дашборда, пока `me.must_change_password`. Это не только
 * оформление: у такой учётки область видимости пуста, и за этим экраном данных
 * всё равно нет — сервер их не отдаст.
 *
 * Смысл в том, что временный пароль приезжает человеку в WhatsApp и остаётся
 * там навсегда. Пока он не сменён, «войти под Даной» может любой, кто пролистал
 * её переписку.
 */
import { useState, type FormEvent } from "react";

import { BbcApiError, setOwnPassword } from "../api";
import { BbcDashboardIcon, LockIcon } from "../icon";

const MIN_LENGTH = 8;

export function SetPasswordScreen({
  fullName,
  onChanged,
}: {
  fullName: string;
  /** Пароль сменён — сессия погашена, оболочка возвращает форму входа. */
  onChanged: () => void;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Проверка на совпадение — на клиенте: сервер второго поля не видит и не
  // должен, а гонять запрос ради опечатки в подтверждении незачем.
  const mismatch = repeat.length > 0 && next !== repeat;
  const tooShort = next.length > 0 && next.length < MIN_LENGTH;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (mismatch || tooShort) return;
    setBusy(true);
    setError(null);
    try {
      await setOwnPassword(current, next);
      onChanged();
    } catch (err) {
      setError(
        err instanceof BbcApiError ? err.message : "Не удалось сменить пароль. Попробуйте ещё раз.",
      );
      setBusy(false);
    }
  }

  return (
    <div
      className="min-h-screen min-h-[100dvh] flex items-center justify-center px-5"
      style={{ background: "var(--page-bg)" }}
    >
      <div
        className="card bbc-grain relative w-full max-w-sm p-7 animate-slide-up"
        style={{ animationDuration: "var(--dur-base)" }}
      >
        <div className="flex items-center gap-2.5 mb-6">
          <span className="logo-badge">
            <BbcDashboardIcon size={16} />
          </span>
          <div className="min-w-0">
            <p className="eyebrow">BBC Consulting</p>
            <h1
              className="text-base font-semibold truncate"
              style={{ color: "var(--text-primary)", letterSpacing: "-0.01em" }}
            >
              {fullName || "Первый вход"}
            </h1>
          </div>
        </div>

        <div
          className="card-inner p-4 mb-5 text-xs leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          <p className="mb-2" style={{ color: "var(--text-primary)" }}>
            Задайте свой пароль
          </p>
          Тот, что вам передали, знает не только вы — он остался в переписке. Пока он не сменён,
          дашборд закрыт.
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="eyebrow">Пароль, который вам выдали</span>
            <input
              className="input-field"
              type="password"
              value={current}
              onChange={(event) => setCurrent(event.target.value)}
              autoComplete="current-password"
              autoFocus
              required
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="eyebrow">Новый пароль</span>
            <input
              className="input-field"
              type="password"
              value={next}
              onChange={(event) => setNext(event.target.value)}
              autoComplete="new-password"
              minLength={MIN_LENGTH}
              required
            />
            <span className="text-xs" style={{ color: tooShort ? "var(--accent-rose)" : "var(--text-muted)" }}>
              Не короче {MIN_LENGTH} символов
            </span>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="eyebrow">Ещё раз</span>
            <input
              className="input-field"
              type="password"
              value={repeat}
              onChange={(event) => setRepeat(event.target.value)}
              autoComplete="new-password"
              required
              aria-invalid={mismatch}
            />
            {mismatch ? (
              <span className="text-xs" style={{ color: "var(--accent-rose)" }}>
                Пароли не совпадают
              </span>
            ) : null}
          </label>

          {error ? (
            <p
              className="text-xs px-3 py-2 rounded-lg"
              style={{
                color: "var(--accent-rose)",
                background: "var(--outflow-bg)",
                border: "1px solid var(--outflow-border)",
              }}
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            className="btn-primary mt-1 px-4 py-2.5"
            disabled={busy || mismatch || tooShort || !next}
          >
            <LockIcon size={15} />
            {busy ? "Сохраняем…" : "Сменить пароль"}
          </button>
        </form>

        <p className="mt-5 text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
          После смены нужно будет войти заново — с новым паролем.
        </p>
      </div>
    </div>
  );
}
