"use client";

import { useRef, useState } from "react";
import type { Column } from "@/lib/api";
import { AutoTextarea } from "@/components/auto-textarea";
import { isUrl, LinkBadge } from "@/components/link-badge";
import { Linkify } from "@/components/linkify";
import ChatBubbleOutline from "@mui/icons-material/ChatBubbleOutline";

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

const iconButton =
  "inline-flex h-6 min-w-6 items-center justify-center gap-0.5 rounded px-1 text-xs text-zinc-400 tabular-nums hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200";

// Shown on hover (or keyboard focus); always shown on touch screens, which
// can't hover.
const hoverOnly = "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100";

// One table cell. Admins click the value to edit it (a long press on a link
// badge, since a click opens the link). A 💬 on the right, shown on hover,
// opens this cell's comment thread; it stays visible once it has comments.
// Editing: Enter or click-away saves, Escape cancels; long text saves on
// Ctrl/Cmd+Enter or click-away; yes/no saves as soon as you pick.
export function Cell({
  column,
  value,
  onSave,
  commentCount = 0,
  commenterColors = [],
  onComment,
}: {
  column: Column;
  value: string | boolean | undefined;
  // Absent: not editable (non-admins, locked rooms).
  onSave?: (value: string | boolean | null) => Promise<void>;
  commentCount?: number;
  // Colors of the members who commented on this cell (dots by the 💬).
  commenterColors?: string[];
  onComment?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  // Enter commits and unmounts the box, which can also fire blur; only the
  // first close counts.
  const closed = useRef(false);
  const current = value === undefined ? "" : column.type === "boolean" ? (value ? "yes" : "no") : String(value);

  // A link badge opens the link on click, so on a link a long press edits.
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);
  function pressStart() {
    if (!onSave) return;
    longPressed.current = false;
    pressTimer.current = setTimeout(() => {
      longPressed.current = true;
      start();
    }, 500);
  }
  function pressEnd() {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = null;
  }

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
    if (v === current || !onSave) return;
    onSave(v === "" ? null : column.type === "boolean" ? v === "yes" : v);
  }

  if (editing) {
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

  return (
    <div className="group flex items-start gap-1">
      {/* Click the value to edit it (admins). */}
      <div
        {...(onSave
          ? {
              role: "button",
              tabIndex: 0,
              "aria-label": `Edit ${column.name}`,
              title: `Edit ${column.name}`,
              onClick: start,
              onKeyDown: (e: React.KeyboardEvent) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  start();
                }
              },
              onPointerDown: pressStart,
              onPointerUp: pressEnd,
              onPointerLeave: pressEnd,
              onPointerCancel: pressEnd,
              // A long press already opened the editor; don't also follow the link.
              onClickCapture: (e: React.MouseEvent) => {
                if (longPressed.current) {
                  e.preventDefault();
                  e.stopPropagation();
                  longPressed.current = false;
                }
              },
            }
          : {})}
        className={`min-w-0 flex-1 rounded px-1 py-0.5 -mx-1 ${
          onSave
            ? "cursor-text hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-zinc-400 dark:hover:bg-zinc-900"
            : ""
        }`}
      >
        <FieldValue column={column} value={value} />
      </div>
      <div className="flex shrink-0 items-center">
        {onComment && (
          <button
            type="button"
            onClick={onComment}
            aria-label={`${commentCount} ${commentCount === 1 ? "comment" : "comments"} on ${column.name}`}
            title={`Comment on ${column.name}`}
            className={`${iconButton} ${commentCount === 0 ? hoverOnly : ""}`}
          >
            <ChatBubbleOutline fontSize="inherit" aria-hidden />
            {commentCount > 0 && commentCount}
            {commenterColors.length > 0 && (
              <span aria-hidden className="ml-0.5 inline-flex items-center gap-0.5">
                {commenterColors.slice(0, 4).map((c, i) => (
                  <span key={i} className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c }} />
                ))}
                {commenterColors.length > 4 && <span className="text-[0.6rem]">+{commenterColors.length - 4}</span>}
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
