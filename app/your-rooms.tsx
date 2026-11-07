"use client";

import Link from "next/link";
import { useSavedRooms } from "@/lib/session";

// Rooms this browser has created or joined. Nothing shows until there's one.
export function YourRooms() {
  const rooms = useSavedRooms();
  if (rooms.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">Your rooms</h2>
      <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {rooms.map((r) => (
          <li key={r.slug}>
            <Link
              href={`/r/${r.slug}`}
              className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-900"
            >
              <span className="truncate">{r.name}</span>
              <span aria-hidden className="text-zinc-400">
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
