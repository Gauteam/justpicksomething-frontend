"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, getRoom, type RoomData } from "./api";
import { clearSession } from "./session";

// Polling budget (see project plan): poll only while the tab is visible, every
// 5s, slowing to 30s after 2 minutes without changes. Any change or local
// action resets to 5s.
const FAST_MS = 5_000;
const SLOW_MS = 30_000;
const SLOW_AFTER_MS = 120_000;

// Loads a room and keeps it fresh. A 401 means the stored token is no longer
// valid, so the session is cleared and the caller falls back to the join form.
export function useRoom(slug: string, token: string | null) {
  const [data, setData] = useState<RoomData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const updatedAt = useRef<string | null>(null);
  const lastChange = useRef(0);

  const fetchRoom = useCallback(
    async (force: boolean) => {
      if (!token) return;
      try {
        const next = await getRoom(slug, token, force ? null : updatedAt.current);
        setError(null);
        if (next) {
          if (next.room.updatedAt !== updatedAt.current) lastChange.current = Date.now();
          updatedAt.current = next.room.updatedAt;
          setData(next);
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          clearSession(slug);
          return;
        }
        setError(err instanceof ApiError ? err.message : "Something went wrong.");
      }
    },
    [slug, token],
  );

  useEffect(() => {
    if (!token) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    const schedule = () => {
      if (stopped) return;
      const idle = Date.now() - lastChange.current > SLOW_AFTER_MS;
      timer = setTimeout(tick, idle ? SLOW_MS : FAST_MS);
    };
    const tick = async () => {
      if (document.visibilityState === "visible") await fetchRoom(false);
      schedule();
    };
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      clearTimeout(timer);
      lastChange.current = Date.now();
      tick();
    };

    lastChange.current = Date.now();
    tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [token, fetchRoom]);

  // Call after a local write: refetch now and return to fast polling.
  const refresh = useCallback(() => {
    lastChange.current = Date.now();
    return fetchRoom(true);
  }, [fetchRoom]);

  return { data, setData, error, refresh };
}
