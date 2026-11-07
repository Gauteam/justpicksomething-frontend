"use client";

import { useMemo, useSyncExternalStore } from "react";

// Per-room credentials kept in this browser. The token identifies the member;
// the passcode is kept so any member can re-share the invite.
export type RoomSession = {
  token: string;
  passcode?: string;
  // The room's passcodeChangedAt when `passcode` was saved; if the room's
  // differs, an admin changed the passcode and the saved one is stale.
  passcodeChangedAt?: string;
  // For "Your rooms" on the home page.
  name?: string;
  lastOpened?: number;
};

const PREFIX = "jps:room:";
const key = (slug: string) => `${PREFIX}${slug}`;

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

// Merges changes into a room's saved session, if there is one.
export function updateSession(slug: string, changes: Partial<RoomSession>) {
  const raw = readRaw(slug);
  if (!raw) return;
  try {
    saveSession(slug, { ...(JSON.parse(raw) as RoomSession), ...changes });
  } catch {
    // Unreadable entry: leave it.
  }
}

export type SavedRoom = { slug: string; name: string; lastOpened: number };

// Snapshot of every saved room as one string, so useSyncExternalStore can
// compare it cheaply.
function readAllRaw(): string {
  const entries: [string, string][] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIX)) entries.push([k, localStorage.getItem(k) ?? ""]);
    }
  } catch {
    // Storage blocked: only the in-memory entries.
  }
  for (const [k, v] of memory) if (!entries.some(([ek]) => ek === k)) entries.push([k, v]);
  return JSON.stringify(entries.sort());
}

// Rooms this browser has created or joined, most recently opened first.
// Empty while rendering on the server.
export function useSavedRooms(): SavedRoom[] {
  const raw = useSyncExternalStore(subscribe, readAllRaw, () => "[]");
  return useMemo(() => {
    const rooms: SavedRoom[] = [];
    for (const [k, v] of JSON.parse(raw) as [string, string][]) {
      try {
        const s = JSON.parse(v) as RoomSession;
        const slug = k.slice(PREFIX.length);
        rooms.push({ slug, name: s.name ?? slug, lastOpened: s.lastOpened ?? 0 });
      } catch {
        // Skip unreadable entries.
      }
    }
    return rooms.sort((a, b) => b.lastOpened - a.lastOpened);
  }, [raw]);
}

// Pulls the room code out of a pasted link (…/r/<code>) or a bare code.
export function parseRoomCode(input: string): string | null {
  const s = input.trim();
  const fromLink = s.match(/\/r\/([A-Za-z0-9]+)/);
  if (fromLink) return fromLink[1];
  return /^[A-Za-z0-9]{6,32}$/.test(s) ? s : null;
}

export const roomLink = (slug: string) => `${typeof window === "undefined" ? "" : window.location.origin}/r/${slug}`;
