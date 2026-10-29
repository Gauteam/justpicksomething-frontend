"use client";

import { useMemo, useSyncExternalStore } from "react";

// Per-room credentials kept in this browser. The token identifies the member;
// the passcode is kept so any member can re-share the invite.
export type RoomSession = { token: string; passcode?: string };

const key = (slug: string) => `jps:room:${slug}`;

// Fallback when localStorage is unavailable (private mode, blocked): the
// member stays joined for this page view only.
const memory = new Map<string, string>();
const listeners = new Set<() => void>();

function readRaw(slug: string): string | null {
  try {
    return localStorage.getItem(key(slug)) ?? memory.get(key(slug)) ?? null;
  } catch {
    return memory.get(key(slug)) ?? null;
  }
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

const notify = () => listeners.forEach((l) => l());

export function saveSession(slug: string, session: RoomSession) {
  const raw = JSON.stringify(session);
  memory.set(key(slug), raw);
  try {
    localStorage.setItem(key(slug), raw);
  } catch {
    // Kept in memory only.
  }
  notify();
}

export function clearSession(slug: string) {
  memory.delete(key(slug));
  try {
    localStorage.removeItem(key(slug));
  } catch {
    // Ignore.
  }
  notify();
}

// The stored session for a room: undefined while rendering on the server
// (storage not readable yet), null when this browser hasn't joined.
export function useRoomSession(slug: string): RoomSession | null | undefined {
  const raw = useSyncExternalStore(
    subscribe,
    () => readRaw(slug),
    () => undefined,
  );
  return useMemo(() => {
    if (raw === undefined) return undefined;
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as RoomSession;
    } catch {
      return null;
    }
  }, [raw]);
}

export const roomLink = (slug: string) => `${typeof window === "undefined" ? "" : window.location.origin}/r/${slug}`;
