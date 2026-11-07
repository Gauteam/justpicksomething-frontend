"use client";

import { useState } from "react";
import { JoinRoom } from "./join-room";

// "Have a room code? Join a room" link that opens the join form.
export function JoinToggle() {
  const [open, setOpen] = useState(false);

  return (
    <section className="space-y-4">
      <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
        Have a room code?{" "}
        <button
          type="button"
          aria-expanded={open}
          aria-controls="join-form"
          onClick={() => setOpen((v) => !v)}
          className="font-medium text-zinc-900 underline underline-offset-4 dark:text-zinc-100"
        >
          {open ? "Hide" : "Join a room"}
        </button>
      </p>
      {open && (
        <div id="join-form" className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <JoinRoom />
        </div>
      )}
    </section>
  );
}
