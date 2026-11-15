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

const selectClass =
  "rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

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

  const shown = (comments ?? [])
    .filter((c) => itemFilter === ALL || c.itemId === itemFilter)
    .filter((c) => rowFilter === ALL || (rowFilter === WHOLE ? c.columnId === null : c.columnId === rowFilter))
    .slice()
    .reverse();

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
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Filter by option"
            className={selectClass}
            value={itemFilter}
            onChange={(e) => setItemFilter(e.target.value)}
          >
            <option value={ALL}>All options</option>
            {items.map((it, i) => (
              <option key={it.id} value={it.id}>
                #{i + 1} {it.title.length > 40 ? `${it.title.slice(0, 39)}…` : it.title}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by row"
            className={selectClass}
            value={rowFilter}
            onChange={(e) => setRowFilter(e.target.value)}
          >
            <option value={ALL}>All rows</option>
            <option value={WHOLE}>Whole option</option>
            {columns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

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
