"use client";

import { useRef, useState } from "react";
import type { Column } from "@/lib/api";
import { AutoTextarea } from "@/components/auto-textarea";
import { isUrl, LinkBadge } from "@/components/link-badge";
import { Linkify } from "@/components/linkify";

export function FieldValue({ column, value, clamp }: { column: Column; value: unknown; clamp?: boolean }) {
  if (value === undefined || value === null || value === "") return <span className="text-zinc-400">—</span>;
  if (column.type === "boolean") return <span>{value === true ? "Yes" : "No"}</span>;
  const text = String(value);
  if (isUrl(text)) return <LinkBadge href={text} />;
  return (
    <span className={`whitespace-pre-wrap break-words ${clamp ? "line-clamp-3" : ""}`}>
      <Linkify text={text} />
    </span>
  );
}

export const editClass =
  "w-full min-w-0 rounded-md border border-zinc-400 bg-white px-2 py-1 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-300";

const LONG_PRESS_MS = 500;

// A value you can edit in place. Click it (or long-press a link badge, since
// a click opens the link) to get a box; Enter or click-away saves, Escape
// cancels. Long text saves on Ctrl/Cmd+Enter or click-away; yes/no saves as
// soon as you pick. Text boxes grow as the text wraps.
export function EditableField({
  column,
  value,
  onSave,
}: {
  column: Column;
  value: string | boolean | undefined;
  onSave: (value: string | boolean | null) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  // Enter commits and unmounts the box, which can also fire blur; only the
  // first close counts.
  const closed = useRef(false);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);
  const current = value === undefined ? "" : column.type === "boolean" ? (value ? "yes" : "no") : String(value);

  function start() {
    closed.current = false;
    setDraft(current);
    setEditing(true);
  }

  function cancel() {
    closed.current = true;
    setEditing(false);
  }

  function commit(next: string) {
    if (closed.current) return;
    closed.current = true;
    setEditing(false);
    const v = next.trim();
    if (v === current) return;
    onSave(v === "" ? null : column.type === "boolean" ? v === "yes" : v);
  }

  function pressStart() {
    longPressed.current = false;
    pressTimer.current = setTimeout(() => {
      longPressed.current = true;
      start();
    }, LONG_PRESS_MS);
  }

  function pressEnd() {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = null;
  }

  if (!editing) {
    return (
      <div
        role="button"
        tabIndex={0}
        aria-label={`Edit ${column.name}`}
        onPointerDown={pressStart}
        onPointerUp={pressEnd}
        onPointerLeave={pressEnd}
        onPointerCancel={pressEnd}
        // A long press already opened the editor; don't also follow the link.
        onClickCapture={(e) => {
          if (longPressed.current) {
            e.preventDefault();
            e.stopPropagation();
            longPressed.current = false;
          }
        }}
        onClick={start}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            start();
          }
        }}
        title={`Edit ${column.name}`}
        className="group -mx-1 flex min-h-7 cursor-text items-start gap-1 rounded border border-transparent px-1 py-0.5 hover:border-zinc-300 hover:bg-zinc-50 focus-visible:border-zinc-400 focus-visible:outline-none dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
      >
        <span className="min-w-0 flex-1">
          {current === "" ? (
            <span className="text-zinc-400 italic opacity-60 group-hover:opacity-100">Add</span>
          ) : (
            <FieldValue column={column} value={value} clamp />
          )}
        </span>
        <span
          aria-hidden
          className="shrink-0 text-xs text-zinc-400 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          ✎
        </span>
      </div>
    );
  }

  if (column.type === "boolean") {
    return (
      <select
        ref={(el) => el?.focus()}
        aria-label={column.name}
        className={editClass}
        value={draft}
        onChange={(e) => commit(e.target.value)}
        onBlur={cancel}
        onKeyDown={(e) => e.key === "Escape" && cancel()}
      >
        <option value="">—</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
    );
  }

  const multiline = column.type === "textarea";
  return (
    <AutoTextarea
      ref={(el) => el?.focus()}
      aria-label={column.name}
      className={editClass}
      value={draft}
      maxLength={multiline ? 2000 : 200}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => commit(draft)}
      onKeyDown={(e) => {
        if (e.key === "Escape") cancel();
        if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
        // Short text: Enter saves. Long text: Enter is a new line; Ctrl/Cmd+Enter saves.
        if (!multiline || e.metaKey || e.ctrlKey) {
          e.preventDefault();
          commit(draft);
        }
      }}
    />
  );
}
