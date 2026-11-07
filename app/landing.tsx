"use client";

import { useState } from "react";
import { CreateRoom } from "./create-room";
import { JoinRoom } from "./join-room";
import { YourRooms } from "./your-rooms";

type Mode = "decide" | "keep";

// Two big choices; picking one swaps the tiles for that flow.
export function Landing() {
  const [mode, setMode] = useState<Mode | null>(null);

  if (mode === null) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <Tile title="Decide" subtitle="Start a new Decision" onClick={() => setMode("decide")} />
        <Tile title="Keep Deciding" subtitle="Join an existing Decision" onClick={() => setMode("keep")} />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <button
        type="button"
        onClick={() => setMode(null)}
        className="text-sm text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-400"
      >
        ← Back
      </button>
      {mode === "decide" ? (
        <CreateRoom />
      ) : (
        <>
          <section className="space-y-4">
            <h2 className="text-lg font-medium">Join a room</h2>
            <JoinRoom />
          </section>
          <YourRooms />
        </>
      )}
    </div>
  );
}

function Tile({ title, subtitle, onClick }: { title: string; subtitle: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-40 flex-col items-center justify-center gap-2 rounded-2xl border border-zinc-300 p-8 text-center transition hover:border-zinc-900 hover:bg-zinc-50 sm:min-h-56 dark:border-zinc-700 dark:hover:border-zinc-100 dark:hover:bg-zinc-900"
    >
      <span className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</span>
      <span className="text-zinc-500 group-hover:text-zinc-700 dark:group-hover:text-zinc-300">{subtitle}</span>
    </button>
  );
}
