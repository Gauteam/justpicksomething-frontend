"use client";

import { useEffect, useState } from "react";
import {
  deleteComment,
  editComment,
  errorMessage,
  listRoomComments,
  setReaction,
  type Column,
  type Comment,
  type Item,
  type Member,
} from "@/lib/api";
import { useConfirm } from "@/components/confirm-dialog";
import { errorClass } from "@/components/styles";
import { applyReaction, CommentRow } from "./comment-row";

// "All", "Whole option" (comments not about one cell), or a column ID.
const ALL = "";
const WHOLE = "__whole__";

// A filter badge: click to filter, click again to clear.
function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs transition ${
        active
          ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
          : "border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      }`}
    >
      {children}
    </button>
  );
}

type Props = {
  slug: string;
  token: string;
  // Options in display order, so "#1" matches the table.
  items: Item[];
  columns: Column[];
  members: Member[];
  me: Member;
  colors: Map<string, string>;
  // Changes whenever anything in the room changes; the stream refetches then,
  // so it adds no polling of its own.
  roomUpdatedAt: string;
  readOnly: boolean;
  onOpen: (item: Item) => void;
  onChanged: () => Promise<void>;
};

// Every comment in the room, newest first, filterable by option and/or row.
export function CommentsStream({
  slug,
  token,
  items,
  columns,
  members,
  me,
  colors,
  roomUpdatedAt,
  readOnly,
  onOpen,
  onChanged,
}: Props) {
  const confirm = useConfirm();
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [itemFilter, setItemFilter] = useState(ALL);
  const [rowFilter, setRowFilter] = useState(ALL);

  useEffect(() => {
    let cancelled = false;
    listRoomComments(slug, token)
      .then((c) => !cancelled && setComments(c))
      .catch((err) => !cancelled && setError(errorMessage(err, "Couldn't load comments.")));
    return () => {
      cancelled = true;
    };
  }, [slug, token, roomUpdatedAt]);

  const names = new Map(members.map((m) => [m.id, m.displayName]));
  const columnName = new Map(columns.map((c) => [c.id, c.name]));
  const rank = new Map(items.map((it, i) => [it.id, i + 1]));
  const byId = new Map(items.map((it) => [it.id, it]));

  const all = comments ?? [];
  const matchesItem = (c: Comment) => itemFilter === ALL || c.itemId === itemFilter;
  const matchesRow = (c: Comment) =>
    rowFilter === ALL || (rowFilter === WHOLE ? c.columnId === null : c.columnId === rowFilter);
  const shown = all.filter((c) => matchesItem(c) && matchesRow(c)).reverse();

  // Badges only for what has comments. Each group's counts follow the other
  // group's choice, so you can see what's left to narrow down.
  const count = (pred: (c: Comment) => boolean) => all.filter(pred).length;
  const itemChips = items
    .map((it) => ({ it, n: count((c) => c.itemId === it.id && matchesRow(c)) }))
    .filter(({ it, n }) => n > 0 || itemFilter === it.id);
  const wholeCount = count((c) => c.columnId === null && matchesItem(c));
  const rowChips = columns
    .map((col) => ({ col, n: count((c) => c.columnId === col.id && matchesItem(c)) }))
    .filter(({ col, n }) => n > 0 || rowFilter === col.id);
  const toggle = (current: string, value: string, set: (v: string) => void) => set(current === value ? ALL : value);

  async function onReact(c: Comment, value: 1 | -1 | 0) {
    setComments((cs) => cs?.map((x) => (x.id === c.id ? applyReaction(x, value) : x)) ?? null);
    try {
      await setReaction(slug, token, c.id, value);
    } catch (err) {
      setError(errorMessage(err, "Couldn't save that."));
    }
    await onChanged();
  }

  async function onEdit(c: Comment, next: string) {
    await editComment(slug, token, c.id, next);
    setComments(
      (cs) => cs?.map((x) => (x.id === c.id ? { ...x, body: next.trim(), editedAt: x.createdAt } : x)) ?? null,
    );
    await onChanged();
  }

  async function onDelete(c: Comment) {
    const ok = await confirm({ title: "Delete this comment?", confirmLabel: "Delete", tone: "danger" });
    if (!ok) return;
    try {
      await deleteComment(slug, token, c.id);
      setComments((cs) => cs?.filter((x) => x.id !== c.id) ?? null);
      await onChanged();
    } catch (err) {
      setError(errorMessage(err, "Couldn't delete that."));
    }
  }

  return (
    <section aria-label="Comments" className="space-y-3 border-t border-zinc-200 pt-6 dark:border-zinc-800">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">
          Comments{comments && comments.length > 0 ? ` (${comments.length})` : ""}
        </h2>
      </div>
      {all.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by option">
            {itemChips.map(({ it, n }) => (
              <Chip key={it.id} active={itemFilter === it.id} onClick={() => toggle(itemFilter, it.id, setItemFilter)}>
                <span className="truncate">
                  #{rank.get(it.id)} {it.title.length > 32 ? `${it.title.slice(0, 31)}…` : it.title}
                </span>
                <span className="tabular-nums opacity-60">{n}</span>
              </Chip>
            ))}
          </div>
          {(wholeCount > 0 || rowChips.length > 0 || rowFilter !== ALL) && (
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by row">
              {(wholeCount > 0 || rowFilter === WHOLE) && (
                <Chip active={rowFilter === WHOLE} onClick={() => toggle(rowFilter, WHOLE, setRowFilter)}>
                  Whole option <span className="tabular-nums opacity-60">{wholeCount}</span>
                </Chip>
              )}
              {rowChips.map(({ col, n }) => (
                <Chip
                  key={col.id}
                  active={rowFilter === col.id}
                  onClick={() => toggle(rowFilter, col.id, setRowFilter)}
                >
                  <span aria-hidden className="text-[0.6rem] leading-none">
                    ◦
                  </span>
                  {col.name} <span className="tabular-nums opacity-60">{n}</span>
                </Chip>
              ))}
            </div>
          )}
        </div>
      )}

      {error && <p className={errorClass}>{error}</p>}
      {comments === null ? (
        !error && <p className="text-sm text-zinc-500">Loading…</p>
      ) : shown.length === 0 ? (
        <p className="text-sm text-zinc-500">
          {comments.length === 0 ? "No comments yet." : "No comments match these filters."}
        </p>
      ) : (
        <ul className="space-y-4">
          {shown.map((c) => {
            const item = byId.get(c.itemId);
            return (
              <CommentRow
                key={c.id}
                comment={c}
                author={names.get(c.authorId) ?? "Someone"}
                authorColor={colors.get(c.authorId)}
                rowName={c.columnId ? columnName.get(c.columnId) : undefined}
                context={
                  item && (
                    <button type="button" onClick={() => onOpen(item)} className="hover:underline">
                      #{rank.get(item.id)} {item.title}
                    </button>
                  )
                }
                canEdit={!readOnly && c.authorId === me.id}
                canDelete={!readOnly && (c.authorId === me.id || me.isAdmin)}
                canReact={!readOnly}
                onEdit={(next) => onEdit(c, next)}
                onDelete={() => onDelete(c)}
                onReact={(v) => onReact(c, v)}
              />
            );
          })}
        </ul>
      )}
    </section>
  );
}
