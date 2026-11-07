"use client";

import { useState } from "react";
import { CreateRoom } from "./create-room";
import { JoinRoom } from "./join-room";

// Create a new room or join one with its link/code.
export function HomeTabs() {
  const [tab, setTab] = useState<"create" | "join">("create");

  const tabClass = (t: typeof tab) =>
    `flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
      tab === t
        ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
        : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
    }`;

  return (
    <div className="space-y-6">
      <div role="tablist" className="flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-900">
        <button
          role="tab"
          type="button"
          aria-selected={tab === "create"}
          className={tabClass("create")}
          onClick={() => setTab("create")}
        >
          Create a room
        </button>
        <button
          role="tab"
          type="button"
          aria-selected={tab === "join"}
          className={tabClass("join")}
          onClick={() => setTab("join")}
        >
          Join a room
        </button>
      </div>
      <div role="tabpanel">{tab === "create" ? <CreateRoom /> : <JoinRoom />}</div>
    </div>
  );
}
