"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
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
import { Panel } from "@/components/panel";
import { errorClass, inputClass, labelClass, primaryButtonClass } from "@/components/styles";
import { SortableRow } from "./item-list";

const typeLabels: Record<ColumnType, string> = { text: "Short text", boolean: "Yes / no", textarea: "Long text" };

type Props = {
  slug: string;
  token: string;
  columns: Column[];
  onChanged: () => Promise<void>;
  onClose: () => void;
};

export function ColumnsPanel({ slug, token, columns, onChanged, onClose }: Props) {
  const [error, setError] = useState<string | null>(null);
  // Local order while a reorder is saving, so the list doesn't jump back.
  const [order, setOrder] = useState<string[] | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const shown = order ? order.map((id) => columns.find((c) => c.id === id)).filter((c): c is Column => !!c) : columns;

  async function run(action: () => Promise<unknown>, fallback: string) {
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(errorMessage(err, fallback));
    }
    await onChanged();
  }

  async function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const ids = shown.map((c) => c.id);
    const next = arrayMove(ids, ids.indexOf(String(e.active.id)), ids.indexOf(String(e.over.id)));
    setOrder(next);
    await run(() => reorderColumns(slug, token, next), "Couldn't reorder.");
    setOrder(null);
  }

  async function onDelete(c: Column) {
    if (!window.confirm(`Delete “${c.name}” and its values on every option?`)) return;
    await run(() => deleteColumn(slug, token, c.id), "Couldn't delete that column.");
  }

  return (
    <Panel title="Columns" onClose={onClose}>
      <div className="space-y-6">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Columns are the details you compare across options, like bedrooms or “hot tub”.
        </p>
        {shown.length > 0 && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={shown.map((c) => c.id)} strategy={verticalListSortingStrategy}>
              <ul className="space-y-2">
                {shown.map((c) => (
                  <SortableRow key={c.id} id={c.id} disabled={false} as="li">
                    {(handle) => (
                      <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950">
                        {handle}
                        <ColumnName
                          key={`${c.id}:${c.name}`}
                          column={c}
                          onRename={(name) => run(() => renameColumn(slug, token, c.id, name), "Couldn't rename.")}
                        />
                        <span className="shrink-0 text-xs text-zinc-500">{typeLabels[c.type]}</span>
                        <button
                          type="button"
                          onClick={() => onDelete(c)}
                          aria-label={`Delete ${c.name}`}
                          className="rounded px-2 py-1 text-zinc-400 hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-800"
                        >
                          ×
                        </button>
                      </div>
                    )}
                  </SortableRow>
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
        {error && <p className={errorClass}>{error}</p>}
        <AddColumnForm
          onAdd={(name, type) => run(() => addColumn(slug, token, name, type), "Couldn't add that column.")}
        />
      </div>
    </Panel>
  );
}

// Inline rename: saves on blur or Enter if the name changed.
function ColumnName({ column, onRename }: { column: Column; onRename: (name: string) => Promise<void> }) {
  const [name, setName] = useState(column.name);

  function commit() {
    const next = name.trim();
    if (!next) setName(column.name);
    else if (next !== column.name) onRename(next);
  }

  return (
    <input
      aria-label={`Rename ${column.name}`}
      className="min-w-0 flex-1 rounded bg-transparent px-1 py-0.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:bg-zinc-900"
      value={name}
      maxLength={40}
      onChange={(e) => setName(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") setName(column.name);
      }}
    />
  );
}

function AddColumnForm({ onAdd }: { onAdd: (name: string, type: ColumnType) => Promise<void> }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<ColumnType>("text");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    await onAdd(name, type);
    setName("");
    setBusy(false);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
      <h3 className="font-semibold">Add a column</h3>
      <div>
        <label htmlFor="column-name" className={labelClass}>
          Name
        </label>
        <input
          id="column-name"
          className={inputClass}
          placeholder="Bedrooms"
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="column-type" className={labelClass}>
          Type
        </label>
        <select
          id="column-type"
          className={inputClass}
          value={type}
          onChange={(e) => setType(e.target.value as ColumnType)}
        >
          {(Object.keys(typeLabels) as ColumnType[]).map((t) => (
            <option key={t} value={t}>
              {typeLabels[t]}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" className={primaryButtonClass} disabled={busy || !name.trim()}>
        Add column
      </button>
    </form>
  );
}
