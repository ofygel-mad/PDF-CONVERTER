"use client";

/**
 * Sign-in gate for the dashboard.
 *
 * Shown whenever `/bbc/me` reports nobody is authenticated. When no admin exists
 * yet the copy switches to first-run guidance instead of pretending a password
 * would work.
 */
import { useState, type FormEvent } from "react";

import { BbcApiError, login } from "../api";
import { BbcDashboardIcon, LockIcon } from "../icon";
import type { BbcMe } from "../types";

type Props = {
  needsSetup: boolean;
  /** The visitor arrived with a link token that no longer works. */
  linkExpired?: boolean;
  /** Получает ответ входа, чтобы оболочка убрала экран без второго запроса. */
  onSignedIn: (me: BbcMe) => void;
};

export function LoginScreen({ needsSetup, linkExpired = false, onSignedIn }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const me = await login(username, password);
      // busy НЕ сбрасываем: экран сейчас сменится, а мигание кнопки обратно в
      // «Войти» читается как «клик не сработал» — человек жмёт второй раз.
      onSignedIn(me);
    } catch (err) {
      setError(
        err instanceof BbcApiError ? err.message : "Не удалось войти. Попробуйте ещё раз.",
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
          <div>
            <p className="eyebrow">BBC Consulting</p>
            <h1
              className="text-base font-semibold"
              style={{ color: "var(--text-primary)", letterSpacing: "-0.01em" }}
            >
              Управленческий отчёт
            </h1>
          </div>
        </div>

        {linkExpired ? (
          <div
            className="card-inner p-4 mb-5 text-xs leading-relaxed"
            style={{ color: "var(--text-secondary)", borderColor: "var(--outflow-border)" }}
            role="status"
          >
            <p className="mb-1" style={{ color: "var(--accent-amber)" }}>
              Ссылка больше не действует
            </p>
            Доступ по ней отозван или истёк срок. Запросите новую ссылку у администратора —
            или войдите под своей учётной записью.
          </div>
        ) : null}

        {needsSetup ? (
          <div className="card-inner p-4 mb-5 text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            <p className="mb-2" style={{ color: "var(--text-primary)" }}>
              Учётная запись ещё не создана
            </p>
            Задайте <code className="mono-meta">BBC_BOOTSTRAP_ADMIN</code> и{" "}
            <code className="mono-meta">BBC_BOOTSTRAP_PASSWORD</code> в окружении бэкенда и
            перезапустите его — первый администратор создастся автоматически. После входа логин
            и пароль меняются в личном кабинете.
          </div>
        ) : null}

        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="eyebrow">Логин</span>
            <input
              className="input-field"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              autoFocus
              required
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="eyebrow">Пароль</span>
            <input
              className="input-field"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
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

          <button type="submit" className="btn-primary mt-1 px-4 py-2.5" disabled={busy}>
            <LockIcon size={15} />
            {busy ? "Вход…" : "Войти"}
          </button>
        </form>

        <p className="mt-5 text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
          Авторизация
        </p>
      </div>
    </div>
  );
}
