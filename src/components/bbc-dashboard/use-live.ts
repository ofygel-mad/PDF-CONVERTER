"use client";

/**
 * Live refresh on the client half.
 *
 * The browser polls only `/bbc/revision` — a ~100 byte response served from the
 * backend's memory that never touches Google. When the revision moves, the full
 * dataset is refetched once. Google API traffic therefore stays constant no
 * matter how many tabs are open.
 *
 * Polling pauses while the tab is hidden and checks immediately on refocus, and
 * backs off when the backend is unreachable so a dead server is not hammered.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { BbcApiError, fetchRevision } from "./api";

const POLL_MS = 5_000;
const MAX_BACKOFF_MS = 60_000;

export type LiveState = {
  /** Latest revision the backend reports. */
  revision: number;
  /** When the underlying sheet last changed. */
  changedAt: string | null;
  /** False once a poll fails — the indicator switches to «нет связи». */
  online: boolean;
  /** Wall-clock of the last successful poll, for «обновлено N сек назад». */
  polledAt: number | null;
};

export function useLive(
  currentRevision: number | undefined,
  onChanged: () => void,
  enabled = true,
): LiveState {
  // Set once the credential dies mid-session; stops the loop so a revoked link
  // does not keep firing rejected requests in the background.
  const stopped = useRef(false);
  const [state, setState] = useState<LiveState>({
    revision: currentRevision ?? 0,
    changedAt: null,
    online: true,
    polledAt: null,
  });

  // Kept in refs so the polling effect never restarts on each render.
  const onChangedRef = useRef(onChanged);
  const knownRevision = useRef(currentRevision ?? 0);
  const backoff = useRef(POLL_MS);

  useEffect(() => {
    onChangedRef.current = onChanged;
  }, [onChanged]);

  useEffect(() => {
    if (currentRevision !== undefined) knownRevision.current = currentRevision;
  }, [currentRevision]);

  const poll = useCallback(async () => {
    try {
      const payload = await fetchRevision();
      backoff.current = POLL_MS;
      setState({
        revision: payload.revision,
        changedAt: payload.changed_at,
        online: true,
        polledAt: Date.now(),
      });

      if (payload.revision > knownRevision.current) {
        knownRevision.current = payload.revision;
        onChangedRef.current();
      }
    } catch (err) {
      if (err instanceof BbcApiError && err.isUnauthorized) {
        // Link revoked or session expired: hand control back to the shell,
        // which shows the login screen. Polling on would only repeat the 401.
        stopped.current = true;
        onChangedRef.current();
        return;
      }
      backoff.current = Math.min(backoff.current * 2, MAX_BACKOFF_MS);
      setState((previous) => ({ ...previous, online: false }));
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;

    // `delay = 0` for the first tick: the poll still runs immediately, but off
    // the effect body, so its setState does not cascade into the same render.
    const schedule = (delay: number) => {
      timer = setTimeout(async () => {
        // A hidden tab burns quota for nothing — wait for it to come back.
        if (document.visibilityState === "visible" && !stopped.current) await poll();
        if (!cancelled && !stopped.current) schedule(backoff.current);
      }, delay);
    };

    const onVisible = () => {
      if (document.visibilityState === "visible" && !stopped.current) void poll();
    };

    schedule(0);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, poll]);

  return state;
}

/**
 * Tracks which numeric values changed between renders, so the UI can flash just
 * those and leave the rest of the page still. Returns a set of changed keys.
 */
export function useChangedKeys(values: Record<string, number>): Set<string> {
  const previous = useRef<Record<string, number> | null>(null);
  const [changed, setChanged] = useState<Set<string>>(new Set());

  useEffect(() => {
    const before = previous.current;
    previous.current = values;
    if (!before) return; // first render is not a "change"

    const moved = new Set<string>();
    for (const [key, value] of Object.entries(values)) {
      if (before[key] !== undefined && before[key] !== value) moved.add(key);
    }
    if (moved.size === 0) return;

    // Both updates are deferred: flagging synchronously here would cascade an
    // extra render on every data refresh.
    const flash = setTimeout(() => setChanged(moved), 0);
    const clear = setTimeout(() => setChanged(new Set()), 700);
    return () => {
      clearTimeout(flash);
      clearTimeout(clear);
    };
  }, [values]);

  return changed;
}
