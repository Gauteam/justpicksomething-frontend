"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { primaryButtonClass } from "./styles";

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel: string;
  // "danger" (red button) for things that delete or can't be undone.
  tone?: "danger" | "default";
};

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Confirm | null>(null);

// Asks for confirmation with the app's dialog; resolves true if confirmed.
// Use instead of window.confirm:
//
//   const confirm = useConfirm();
//   if (!(await confirm({ title: "Delete it?", confirmLabel: "Delete", tone: "danger" }))) return;
export function useConfirm(): Confirm {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error("useConfirm needs a <ConfirmProvider> above it");
  return confirm;
}

// Mount once near the root (app/layout.tsx). Shows one dialog at a time.
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null);

  const confirm = useCallback<Confirm>(
    (options) =>
      new Promise<boolean>((resolve) => {
        setPending((current) => {
          current?.resolve(false); // a newer question replaces an unanswered one
          return { ...options, resolve };
        });
      }),
    [],
  );

  function answer(ok: boolean) {
    pending?.resolve(ok);
    setPending(null);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && <ConfirmDialog {...pending} onConfirm={() => answer(true)} onCancel={() => answer(false)} />}
    </ConfirmContext.Provider>
  );
}

// The dialog itself. Escape or a click outside cancels; focus starts on
// Cancel so a stray Enter doesn't confirm.
function ConfirmDialog({
  title,
  message,
  confirmLabel,
  tone = "default",
  onConfirm,
  onCancel,
}: ConfirmOptions & { onConfirm: () => void; onCancel: () => void }) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const onCancelRef = useRef(onCancel);
  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Don't also close a panel underneath.
      e.stopImmediatePropagation();
      onCancelRef.current();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} aria-hidden />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby={message ? "confirm-message" : undefined}
        className="relative w-full max-w-sm space-y-4 rounded-2xl bg-white p-5 shadow-xl dark:bg-zinc-900"
      >
        <h2 id="confirm-title" className="text-lg font-semibold break-words">
          {title}
        </h2>
        {message && (
          <p id="confirm-message" className="text-sm text-zinc-600 dark:text-zinc-400">
            {message}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={
              tone === "danger"
                ? "rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                : primaryButtonClass
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
