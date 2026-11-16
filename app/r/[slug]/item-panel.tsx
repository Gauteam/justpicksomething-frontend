"use client";

import { useEffect, useState } from "react";
import {
  addComment,
  deleteComment,
  setReaction,
  type CommentKind,
  editComment,
  errorMessage,
  listComments,
  updateItem,
  type Column,
  type Comment,
  type Item,
  type Member,
} from "@/lib/api";
import { Panel } from "@/components/panel";
import { errorClass, inputClass, labelClass, primaryButtonClass } from "@/components/styles";
import { FieldValue, Votes, type Voting } from "./item-list";
import { useConfirm } from "@/components/confirm-dialog";
import { memberColors } from "@/lib/colors";
import { applyReaction, CommentRow } from "./comment-row";
import EditOutlined from "@mui/icons-material/EditOutlined";
import PriorityHigh from "@mui/icons-material/PriorityHigh";
import ThumbDown from "@mui/icons-material/ThumbDown";
import ThumbUp from "@mui/icons-material/ThumbUp";

type Props = {
  slug: string;
  token: string;
  item: Item;
  columns: Column[];
  members: Member[];
  me: Member;
  // Changes whenever anything in the room changes; the thread refetches then.
  roomUpdatedAt: string;
  voting: Voting;
  // The room is locked in: show everything, change nothing.
  readOnly: boolean;
  // Can change the option's title and values (admins, while unlocked).
  canEditItem: boolean;
  onChanged: () => Promise<void>;
  onClose: () => void;
  // Asks to delete this option (opens a confirmation). Shown when canEditItem.
  onDelete: () => void;
};

// The option's side rail: a compact card (name, votes, values) with Edit for
// admins (the full editor opens in place), then the comments.
export function ItemPanel(props: Props) {
  const { item, columns, onClose } = props;
  const [editing, setEditing] = useState(false);
  const filled = columns.filter((c) => item.fields[c.id] !== undefined);

  return (
    <Panel title={item.title} onClose={onClose}>
      <div className="space-y-6">
        {editing ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Edit option</h3>
              <button
                type="button"
                className="text-sm text-zinc-600 hover:underline dark:text-zinc-400"
                onClick={() => setEditing(false)}
              >
                Done
              </button>
            </div>
            <ItemEditor {...props} />
            <button
              type="button"
              onClick={props.onDelete}
              className="text-sm font-medium text-red-600 hover:underline dark:text-red-400"
            >
              Delete option
            </button>
          </div>
        ) : (
          <div className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 font-semibold break-words">{item.title}</p>
              {props.canEditItem && (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="shrink-0 rounded-lg border border-zinc-300 px-2.5 py-1 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  <EditOutlined fontSize="inherit" aria-hidden /> Edit
                </button>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Votes item={item} voting={props.voting} />
            </div>
            {filled.length > 0 && (
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                {filled.map((c) => (
                  <div key={c.id} className="contents">
                    <dt className="text-zinc-500">{c.name}</dt>
                    <dd className="min-w-0">
                      <FieldValue column={c} value={item.fields[c.id]} clamp />
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        )}
        <Comments {...props} />
      </div>
    </Panel>
  );
}

// The quick-signal post buttons (a plain Comment is the form's submit).
const KIND_BUTTONS: { kind: CommentKind; symbol: React.ReactNode; label: string; className: string }[] = [
  {
    kind: "emphasis",
    symbol: <PriorityHigh fontSize="small" />,
    label: "Post with emphasis",
    className: "bg-red-600 hover:bg-red-700",
  },
  {
    kind: "up",
    symbol: <ThumbUp fontSize="small" />,
    label: "Post a thumbs up",
    className: "bg-green-600 hover:bg-green-700",
  },
  {
    kind: "down",
    symbol: <ThumbDown fontSize="small" />,
    label: "Post a thumbs down",
    className: "bg-orange-500 hover:bg-orange-600",
  },
];

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

// An option's comments. With `cellColumnId`, only that cell's thread (and new
// comments go to that cell); without it, everything on the option, with cell
// comments labelled, and a choice of what a new comment is about.
export function Comments({
  slug,
  token,
  item,
  columns,
  members,
  me,
  roomUpdatedAt,
  readOnly,
  onChanged,
  cellColumnId,
}: Pick<
  Props,
  "slug" | "token" | "item" | "columns" | "members" | "me" | "roomUpdatedAt" | "readOnly" | "onChanged"
> & {
  cellColumnId?: string;
}) {
  const confirm = useConfirm();
  const [about, setAbout] = useState("");
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
    post("comment");
  }

  // Posts what's typed as `kind`. A plain comment needs text; the signals
  // (!!, 👍, 👎) can go without.
  async function post(kind: CommentKind) {
    if (kind === "comment" && !body.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const c = await addComment(slug, token, item.id, body, cellColumnId ?? (about || null), kind);
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

  async function onReact(c: Comment, value: 1 | -1 | 0) {
    setComments((cs) => cs?.map((x) => (x.id === c.id ? applyReaction(x, value) : x)) ?? null);
    try {
      await setReaction(slug, token, c.id, value);
    } catch (err) {
      setError(errorMessage(err, "Couldn't save that."));
    }
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

  const columnName = new Map(columns.map((c) => [c.id, c.name]));
  const colors = memberColors(members);
  const shown = comments && (cellColumnId ? comments.filter((c) => c.columnId === cellColumnId) : comments);

  return (
    <section className={`space-y-3 ${cellColumnId ? "" : "border-t border-zinc-200 pt-4 dark:border-zinc-800"}`}>
      {!cellColumnId && <h3 className="font-semibold">Comments</h3>}
      {shown === null ? (
        !error && <p className="text-sm text-zinc-500">Loading…</p>
      ) : shown.length === 0 ? (
        <p className="text-sm text-zinc-500">No comments yet.</p>
      ) : (
        <ul className="space-y-3">
          {shown.map((c) => (
            <CommentRow
              key={c.id}
              comment={c}
              authorColor={colors.get(c.authorId)}
              rowName={!cellColumnId && c.columnId ? columnName.get(c.columnId) : undefined}
              canReact={!readOnly}
              onReact={(v) => onReact(c, v)}
              author={names.get(c.authorId) ?? "Someone"}
              canEdit={!readOnly && c.authorId === me.id}
              canDelete={!readOnly && (c.authorId === me.id || me.isAdmin)}
              onEdit={(next) => onEdit(c, next)}
              onDelete={() => onDelete(c)}
            />
          ))}
        </ul>
      )}
      {error && <p className={errorClass}>{error}</p>}
      {!readOnly && (
        <form onSubmit={onSubmit} className="space-y-2">
          <label htmlFor="new-comment" className="sr-only">
            Add a comment
          </label>
          {!cellColumnId && columns.length > 0 && (
            <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
              About
              <select
                className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                value={about}
                onChange={(e) => setAbout(e.target.value)}
              >
                <option value="">The whole option</option>
                {columns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <textarea
            id="new-comment"
            className={`${inputClass} min-h-20`}
            placeholder="Add a comment…"
            value={body}
            maxLength={1000}
            onChange={(e) => setBody(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <button type="submit" className={primaryButtonClass} disabled={busy || !body.trim()}>
              Comment
            </button>
            {KIND_BUTTONS.map((k) => (
              <button
                key={k.kind}
                type="button"
                disabled={busy}
                onClick={() => post(k.kind)}
                aria-label={k.label}
                title={k.label}
                className={`inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold text-white transition disabled:opacity-50 ${k.className}`}
              >
                {k.symbol}
              </button>
            ))}
          </div>
        </form>
      )}
    </section>
  );
}

// One cell's comment thread: what people said about this option's value in
// this column.
export function CellCommentsPanel(
  props: Pick<
    Props,
    "slug" | "token" | "item" | "columns" | "members" | "me" | "roomUpdatedAt" | "readOnly" | "onChanged" | "onClose"
  > & {
    column: Column;
  },
) {
  const { item, column, onClose } = props;
  return (
    <Panel title={`${item.title} · ${column.name}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-lg bg-zinc-50 p-3 text-sm dark:bg-zinc-900">
          <p className="text-xs text-zinc-500">{column.name}</p>
          <FieldValue column={column} value={item.fields[column.id]} />
        </div>
        <Comments {...props} cellColumnId={column.id} />
      </div>
    </Panel>
  );
}
