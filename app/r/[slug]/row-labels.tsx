"use client";

import { useState } from "react";
import {
  addColumn,
  deleteColumn,
  errorMessage,
  renameColumn,
  reorderColumns,
  type Column,
  type ColumnType,
} from "@/lib/api";
import { AutoTextarea } from "@/components/auto-textarea";
import { useConfirm } from "@/components/confirm-dialog";
import { Menu } from "@/components/menu";
import { secondaryButtonClass } from "@/components/styles";
import { editClass } from "./fields";

const typeLabels: Record<ColumnType, string> = { text: "Short text", boolean: "Yes / no", textarea: "Long text" };

type Manage = {
  slug: string;
  token: string;
  columns: Column[];
  onChanged: () => Promise<void>;
  onError: (message: string | null) => void;
};

// A detail's name at the start of its table row. Admins get a ⋯ menu to
// rename, move or delete it.
export function RowLabel({ column, editable, ...m }: Manage & { column: Column; editable: boolean }) {
  const confirm = useConfirm();
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(column.name);
  const index = m.columns.findIndex((c) => c.id === column.id);

  async function run(action: () => Promise<unknown>, fallback: string) {
    m.onError(null);
    try {
      await action();
    } catch (err) {
      m.onError(errorMessage(err, fallback));
    }
    await m.onChanged();
  }

  function move(by: -1 | 1) {
    const ids = m.columns.map((c) => c.id);
    [ids[index], ids[index + by]] = [ids[index + by], ids[index]];
    run(() => reorderColumns(m.slug, m.token, ids), "Couldn't move that row.");
  }

  async function remove() {
    const ok = await confirm({
      title: `Delete the “${column.name}” row?`,
      message: "Its value on every option will be deleted too. This can't be undone.",
      confirmLabel: "Delete row",
      tone: "danger",
    });
    if (ok) run(() => deleteColumn(m.slug, m.token, column.id), "Couldn't delete that row.");
  }

  function commitRename() {
    setRenaming(false);
    const name = draft.trim();
    if (name && name !== column.name) run(() => renameColumn(m.slug, m.token, column.id, name), "Couldn't rename.");
    else setDraft(column.name);
  }

  if (renaming) {
    return (
      <AutoTextarea
        ref={(el) => el?.focus()}
        aria-label={`Rename ${column.name}`}
        className={editClass}
        value={draft}
        maxLength={40}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitRename}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commitRename();
          }
          if (e.key === "Escape") {
            setDraft(column.name);
            setRenaming(false);
          }
        }}
      />
    );
  }

  return (
    <div className="flex items-start justify-between gap-1">
      <span className="min-w-0 pt-0.5 text-sm font-medium break-words text-zinc-600 dark:text-zinc-400">
        {column.name}
      </span>
      {editable && (
        <Menu
          label={`${column.name} options`}
          items={[
            {
              label: "Rename",
              onSelect: () => {
                setDraft(column.name);
                setRenaming(true);
              },
            },
            { label: "Move up", onSelect: () => move(-1), disabled: index === 0 },
            { label: "Move down", onSelect: () => move(1), disabled: index === m.columns.length - 1 },
            { label: "Delete row", onSelect: remove, danger: true },
          ]}
        />
      )}
    </div>
  );
}

// "+ Add row": adds a detail (a table row / a field on every option).
export function AddColumnButton({ slug, token, onChanged, onError }: Omit<Manage, "columns">) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<ColumnType>("text");
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!name.trim()) return;
    setBusy(true);
    onError(null);
    try {
      await addColumn(slug, token, name.trim(), type);
      setName("");
      setType("text");
      setOpen(false);
    } catch (err) {
      onError(errorMessage(err, "Couldn't add that row."));
    }
    setBusy(false);
    await onChanged();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-400"
      >
        + Add row
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={(el) => el?.focus()}
        aria-label="New row name"
        placeholder="e.g. Bedrooms"
        className={`${editClass} w-40`}
        value={name}
        maxLength={40}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") add();
          if (e.key === "Escape") setOpen(false);
        }}
      />
      <select
        aria-label="New row type"
        className={`${editClass} w-auto`}
        value={type}
        onChange={(e) => setType(e.target.value as ColumnType)}
      >
        {(Object.keys(typeLabels) as ColumnType[]).map((t) => (
          <option key={t} value={t}>
            {typeLabels[t]}
          </option>
        ))}
      </select>
      <button type="button" className={secondaryButtonClass} disabled={busy || !name.trim()} onClick={add}>
        Add
      </button>
      <button
        type="button"
        className="text-sm text-zinc-500 hover:underline"
        onClick={() => {
          setOpen(false);
          setName("");
        }}
      >
        Cancel
      </button>
    </div>
  );
}
