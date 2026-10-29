"use client";

import { useEffect, useState } from "react";
import { getHealth } from "@/lib/api";

type State = { kind: "loading" } | { kind: "ok" } | { kind: "error"; message: string };

export function HealthStatus() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    getHealth(controller.signal)
      .then((h) =>
        setState(h.status === "ok" ? { kind: "ok" } : { kind: "error", message: `db: ${h.db}` }),
      )
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setState({ kind: "error", message: err instanceof Error ? err.message : String(err) });
      });
    return () => controller.abort();
  }, []);

  const label =
    state.kind === "loading" ? "checking…" : state.kind === "ok" ? "ok" : `error (${state.message})`;
  const color =
    state.kind === "loading"
      ? "text-zinc-500"
      : state.kind === "ok"
        ? "text-green-600 dark:text-green-400"
        : "text-red-600 dark:text-red-400";

  return (
    <p className="font-mono text-sm" aria-live="polite">
      API: <span className={color}>{label}</span>
    </p>
  );
}
