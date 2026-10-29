"use client";

import { useEffect, useState } from "react";
import {
  addComment,
  deleteComment,
  editComment,
  errorMessage,
  listComments,
  updateItem,
  type Column,
  type Comment,
  type Item,
  type Member,
} from "@/lib/api";
import { Linkify } from "@/components/linkify";
import { Panel } from "@/components/panel";
import { errorClass, inputClass, labelClass, primaryButtonClass, secondaryButtonClass } from "@/components/styles";
import { Votes } from "./item-list";

type Props = {
  slug: string;
  token: string;
  item: Item;
  columns: Column[];
  members: Member[];
  me: Member;
  // Changes whenever anything in the room changes; the thread refetches then.
  roomUpdatedAt: string;
  onVote: (item: Item, value: 1 | -1) => void;
  onChanged: () => Promise<void>;
  onClose: () => void;
};

export function ItemPanel(props: Props) {
  const { item, onClose } = props;
  return (
    <Panel title={item.title} onClose={onClose}>
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Votes item={item} onVote={props.onVote} />
        </div>
        <ItemEditor {...props} />
        <Comments {...props} />
      </div>
    </Panel>
  );
}

// Boolean values are edited as "" (empty) / "yes" / "no".
type Draft = { title: string; fields: Record<string, string> };

function toDraft(item: Item, columns: Column[]): Draft {
  const fields: Record<string, string> = {};
  for (const c of columns) {
    const v = item.fields[c.id];
    fields[c.id] = v === undefined ? "" : c.type === "boolean" ? (v ? "yes" : "no") : String(v);
  }
  return { title: item.title, fields };
}

function ItemEditor({ slug, token, item, columns, onChanged }: Props) {
  // Snapshot of the item when the panel opened; edits from others while it's
  // open don't overwrite what you're typing.
  const [original] = useState(() => toDraft(item, columns));
  const [draft, setDraft] = useState(original);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const changedFields = columns.filter((c) => (draft.fields[c.id] ?? "") !== (original.fields[c.id] ?? ""));
  const titleChanged = draft.title.trim() !== original.title;
  const dirty = titleChanged || changedFields.length > 0;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!dirty) return;
    const fields: Record<string, string | boolean | null> = {};
    for (const c of changedFields) {
      const v = draft.fields[c.id] ?? "";
      fields[c.id] = v === "" ? null : c.type === "boolean" ? v === "yes" : v;
    }
    setBusy(true);
    setError(null);
    try {
      await updateItem(slug, token, item.id, {
        ...(titleChanged ? { title: draft.title } : {}),
        ...(changedFields.length > 0 ? { fields } : {}),
      });
      setSaved(true);
      await onChanged();
    } catch (err) {
      setError(errorMessage(err, "Couldn't save."));
    } finally {
      setBusy(false);
    }
  }

  const set = (id: string, value: string) => {
    setSaved(false);
    setDraft((d) => ({ ...d, fields: { ...d.fields, [id]: value } }));
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <label htmlFor="item-title" className={labelClass}>
          Option
        </label>
        <input
          id="item-title"
          className={inputClass}
          value={draft.title}
          maxLength={200}
          onChange={(e) => {
            setSaved(false);
            setDraft((d) => ({ ...d, title: e.target.value }));
          }}
          required
        />
      </div>
      {columns.map((c) => (
        <div key={c.id}>
          <label htmlFor={`field-${c.id}`} className={labelClass}>
            {c.name}
          </label>
          {c.type === "boolean" ? (
            <select
              id={`field-${c.id}`}
              className={inputClass}
              value={draft.fields[c.id] ?? ""}
              onChange={(e) => set(c.id, e.target.value)}
            >
              <option value="">—</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          ) : c.type === "textarea" ? (
            <textarea
              id={`field-${c.id}`}
              className={`${inputClass} min-h-24`}
              value={draft.fields[c.id] ?? ""}
              maxLength={2000}
              onChange={(e) => set(c.id, e.target.value)}
            />
          ) : (
            <input
              id={`field-${c.id}`}
              className={inputClass}
              value={draft.fields[c.id] ?? ""}
              maxLength={200}
              onChange={(e) => set(c.id, e.target.value)}
            />
          )}
        </div>
      ))}
      {columns.length === 0 && (
        <p className="text-sm text-zinc-500">No columns yet. An admin can add some with “Columns”.</p>
      )}
      {error && <p className={errorClass}>{error}</p>}
      <div className="flex items-center gap-3">
        <button type="submit" className={primaryButtonClass} disabled={busy || !dirty || !draft.title.trim()}>
          {busy ? "Saving…" : "Save"}
        </button>
        {saved && !dirty && <span className="text-sm text-zinc-500">Saved</span>}
      </div>
    </form>
  );
}

function Comments({ slug, token, item, members, me, roomUpdatedAt, onChanged }: Props) {
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const names = new Map(members.map((m) => [m.id, m.displayName]));

  // Fetch when opened and whenever the room changes (comments bump the
  // room's updatedAt), so an open thread costs no extra polling.
  useEffect(() => {
    let cancelled = false;
    listComments(slug, token, item.id)
      .then((c) => !cancelled && setComments(c))
      .catch((err) => !cancelled && setError(errorMessage(err, "Couldn't load comments.")));
    return () => {
      cancelled = true;
    };
  }, [slug, token, item.id, roomUpdatedAt]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const c = await addComment(slug, token, item.id, body);
      setComments((cs) => [...(cs ?? []), c]);
      setBody("");
      await onChanged();
    } catch (err) {
      setError(errorMessage(err, "Couldn't post that."));
    } finally {
      setBusy(false);
    }
  }

  async function onEdit(c: Comment, next: string) {
    await editComment(slug, token, c.id, next);
    setComments(
      (cs) => cs?.map((x) => (x.id === c.id ? { ...x, body: next.trim(), editedAt: x.createdAt } : x)) ?? null,
    );
    await onChanged();
  }

  async function onDelete(c: Comment) {
    if (!window.confirm("Delete this comment?")) return;
    try {
      await deleteComment(slug, token, c.id);
      setComments((cs) => cs?.filter((x) => x.id !== c.id) ?? null);
      await onChanged();
    } catch (err) {
      setError(errorMessage(err, "Couldn't delete that."));
    }
  }

  return (
    <section className="space-y-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
      <h3 className="font-semibold">Comments</h3>
      {comments === null ? (
        !error && <p className="text-sm text-zinc-500">Loading…</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-zinc-500">No comments yet.</p>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => (
            <CommentRow
              key={c.id}
              comment={c}
              author={names.get(c.authorId) ?? "Someone"}
              canEdit={c.authorId === me.id}
              canDelete={c.authorId === me.id || me.isAdmin}
              onEdit={(next) => onEdit(c, next)}
              onDelete={() => onDelete(c)}
            />
          ))}
        </ul>
      )}
      {error && <p className={errorClass}>{error}</p>}
      <form onSubmit={onSubmit} className="space-y-2">
        <label htmlFor="new-comment" className="sr-only">
          Add a comment
        </label>
        <textarea
          id="new-comment"
          className={`${inputClass} min-h-20`}
          placeholder="Add a comment…"
          value={body}
          maxLength={1000}
          onChange={(e) => setBody(e.target.value)}
        />
        <button type="submit" className={primaryButtonClass} disabled={busy || !body.trim()}>
          {busy ? "Posting…" : "Comment"}
        </button>
      </form>
    </section>
  );
}

const timeFormat = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function CommentRow({
  comment,
  author,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: {
  comment: Comment;
  author: string;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (body: string) => Promise<void>;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
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
    <li className="text-sm">
      <p className="text-xs text-zinc-500">
        <span className="font-medium text-zinc-700 dark:text-zinc-300">{author}</span> ·{" "}
        {timeFormat.format(new Date(comment.createdAt))}
        {comment.editedAt && " (edited)"}
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
          <p className="mt-0.5 whitespace-pre-wrap break-words">
            <Linkify text={comment.body} />
          </p>
          {(canEdit || canDelete) && (
            <div className="mt-1 flex gap-3 text-xs text-zinc-500">
              {canEdit && (
                <button type="button" className="hover:underline" onClick={() => setEditing(true)}>
                  Edit
                </button>
              )}
              {canDelete && (
                <button type="button" className="hover:underline" onClick={onDelete}>
                  Delete
                </button>
              )}
            </div>
          )}
        </>
      )}
    </li>
  );
}
