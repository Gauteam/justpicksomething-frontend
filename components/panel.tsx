"use client";

import { useEffect, useRef } from "react";

// A dialog that slides in from the right on desktop and up from the bottom
// on mobile. Closes on Escape or a backdrop click.
export function Panel({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  // Latest onClose without re-running the mount effect (which would steal
  // focus from inputs) when the parent passes a new function.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCloseRef.current();
    document.addEventListener("keydown", onKey);
    ref.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-40 flex items-end md:items-stretch md:justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="relative flex max-h-[85vh] w-full flex-col rounded-t-2xl bg-white shadow-xl outline-none md:max-h-none md:max-w-md md:rounded-none dark:bg-zinc-950"
      >
        <div className="flex items-center justify-between gap-4 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h2 className="min-w-0 truncate text-lg font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg px-2 py-1 text-xl leading-none text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
      </div>
    </div>
  );
}
