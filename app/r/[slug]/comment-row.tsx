"use client";

import { useState } from "react";
import { errorMessage, type Comment } from "@/lib/api";
import { Linkify } from "@/components/linkify";
import { MemberName } from "@/components/member-name";
import { errorClass, inputClass, primaryButtonClass, secondaryButtonClass } from "@/components/styles";

// Signal comments get a colored border around the whole comment, with their
// symbol on the bottom-right corner. Plain comments have neither.
const KIND_STYLES: Record<string, { symbol: string; label: string; border: string; badge: string }> = {
  emphasis: { symbol: "!!", label: "Emphasis", border: "border-red-600/50", badge: "bg-red-600/50" },
  up: { symbol: "👍", label: "Thumbs up", border: "border-green-600/50", badge: "bg-green-600/50" },
  down: { symbol: "👎", label: "Thumbs down", border: "border-orange-500/50", badge: "bg-orange-500/50" },
};

const timeFormat = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

// One comment: author (in their color), time, an optional "◦ Row" badge for a
// cell comment, the text, ★ / ⚑ emphasis, and Edit / Delete when allowed.
export function CommentRow({
  comment,
  author,
  authorColor,
  rowName,
  context,
  canEdit,
  canDelete,
  canReact,
  onEdit,
  onDelete,
  onReact,
}: {
  comment: Comment;
  author: string;
  authorColor?: string;
  // The row a cell comment is about; shown as a badge left of the text.
  rowName?: string;
  // Extra context after the time (e.g. which option, in the stream).
  context?: React.ReactNode;
  canEdit: boolean;
  canDelete: boolean;
  canReact: boolean;
  onEdit: (body: string) => Promise<void>;
  onDelete: () => void;
  // 1 = ★, -1 = ⚑, 0 = clear.
  onReact: (value: 1 | -1 | 0) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const kind = comment.kind !== "comment" ? KIND_STYLES[comment.kind] : undefined;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await onEdit(draft);
      setEditing(false);
    } catch (err) {
      setError(errorMessage(err, "Couldn't save."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li
      className={`text-sm ${kind ? `relative rounded-xl border-2 px-3 pt-2 pb-3 ${kind.border}` : ""}`}
      aria-label={kind ? `${kind.label} comment` : undefined}
    >
      {kind && (
        // A solid page-colored backing, so the faded badge doesn't let the
        // border show through it.
        <span
          aria-hidden
          title={kind.label}
          className="absolute -right-2 -bottom-2.5 rounded-full bg-white ring-2 ring-white dark:bg-zinc-950 dark:ring-zinc-950"
        >
          <span
            className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-bold text-white ${kind.badge}`}
          >
            {kind.symbol}
          </span>
        </span>
      )}
      <p className="text-xs text-zinc-500">
        <MemberName name={author} color={authorColor} /> · {timeFormat.format(new Date(comment.createdAt))}
        {comment.editedAt && " (edited)"}
        {context && <> · {context}</>}
      </p>
      {editing ? (
        <form onSubmit={save} className="mt-1 space-y-2">
          <textarea
            className={`${inputClass} min-h-20`}
            value={draft}
            maxLength={1000}
            onChange={(e) => setDraft(e.target.value)}
            aria-label="Edit comment"
          />
          {error && <p className={errorClass}>{error}</p>}
          <div className="flex gap-2">
            <button type="submit" className={primaryButtonClass} disabled={busy || !draft.trim()}>
              Save
            </button>
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={() => {
                setEditing(false);
                setDraft(comment.body);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <p className="mt-1 whitespace-pre-wrap break-words">
            {rowName && (
              <span className="mr-1.5 inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 align-[1px] text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                <span aria-hidden className="text-[0.6rem] leading-none">
                  ◦
                </span>
                {rowName}
              </span>
            )}
            <Linkify text={comment.body} />
          </p>
          <div className="mt-1 flex items-center gap-1 text-xs text-zinc-500">
            <Emphasis
              symbol="★"
              label="Star"
              count={comment.stars}
              mine={comment.myReaction === 1}
              activeClass="border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-300"
              disabled={!canReact}
              onClick={() => onReact(comment.myReaction === 1 ? 0 : 1)}
            />
            <Emphasis
              symbol="⚑"
              label="Flag a concern"
              count={comment.concerns}
              mine={comment.myReaction === -1}
              activeClass="border-red-400 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-950/40 dark:text-red-300"
              disabled={!canReact}
              onClick={() => onReact(comment.myReaction === -1 ? 0 : -1)}
            />
            {canEdit && (
              <button type="button" className="ml-2 hover:underline" onClick={() => setEditing(true)}>
                Edit
              </button>
            )}
            {canDelete && (
              <button type="button" className="ml-2 hover:underline" onClick={onDelete}>
                Delete
              </button>
            )}
          </div>
        </>
      )}
    </li>
  );
}

function Emphasis(props: {
  symbol: string;
  label: string;
  count: number;
  mine: boolean;
  activeClass: string;
  disabled: boolean;
  onClick: () => void;
}) {
  // Hide an empty, unclickable counter (e.g. in a locked room).
  if (props.disabled && props.count === 0) return null;
  return (
    <button
      type="button"
      aria-label={`${props.label} (${props.count})`}
      aria-pressed={props.mine}
      title={props.label}
      disabled={props.disabled}
      onClick={props.onClick}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 tabular-nums disabled:cursor-default ${
        props.mine
          ? props.activeClass
          : "border-zinc-200 enabled:hover:bg-zinc-100 dark:border-zinc-700 dark:enabled:hover:bg-zinc-800"
      }`}
    >
      <span aria-hidden>{props.symbol}</span>
      {props.count > 0 && props.count}
    </button>
  );
}

// The comment as it would look with the viewer's emphasis changed to `value`.
export function applyReaction(c: Comment, value: 1 | -1 | 0): Comment {
  let { stars, concerns } = c;
  if (c.myReaction === 1) stars--;
  if (c.myReaction === -1) concerns--;
  if (value === 1) stars++;
  if (value === -1) concerns++;
  return { ...c, stars, concerns, myReaction: value };
}
