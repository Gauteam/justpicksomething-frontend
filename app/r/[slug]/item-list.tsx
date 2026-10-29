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
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Column, Item } from "@/lib/api";
import { effectiveSort, isSortable, type Sort, type SortKey } from "@/lib/sort";
import { Linkify } from "@/components/linkify";

type Props = {
  items: Item[];
  columns: Column[];
  names: Map<string, string>;
  sort: Sort;
  canDrag: boolean;
  onSort: (key: SortKey) => void;
  onVote: (item: Item, value: 1 | -1) => void;
  onOpen: (item: Item) => void;
  onReorder: (ids: string[]) => void;
};

export function ItemList({ items, columns, names, sort, canDrag, onSort, onVote, onOpen, onReorder }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const active = effectiveSort(sort, columns);

  // Same track sizes for the header and every row so the "table" lines up.
  const gridTemplateColumns = [
    canDrag ? "2rem" : null,
    "2rem",
    "minmax(12rem, 2fr)",
    ...columns.map((c) =>
      c.type === "boolean" ? "6rem" : c.type === "textarea" ? "minmax(12rem, 2fr)" : "minmax(8rem, 1fr)",
    ),
    "8.5rem",
    "3.5rem",
  ]
    .filter(Boolean)
    .join(" ");

  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const ids = items.map((i) => i.id);
    onReorder(arrayMove(ids, ids.indexOf(String(e.active.id)), ids.indexOf(String(e.over.id))));
  }

  // The table and the cards each get their own drag context: both render the
  // same item IDs, which can't share one.
  const sortable = (children: React.ReactNode) => (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );

  return (
    <>
      {sortable(
        /* Desktop: comparison table */
        <div className="hidden overflow-x-auto rounded-xl border border-zinc-200 md:block dark:border-zinc-800">
          <div className="min-w-max" role="table" aria-label="Options">
            <div
              role="row"
              className="grid items-center gap-3 border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium tracking-wide text-zinc-500 uppercase dark:border-zinc-800 dark:bg-zinc-900"
              style={{ gridTemplateColumns }}
            >
              {canDrag && <span role="columnheader" aria-label="Reorder" />}
              <span role="columnheader">#</span>
              <HeaderButton label="Option" sortKey="title" active={active} onSort={onSort} />
              {columns.map((c) =>
                isSortable(c) ? (
                  <HeaderButton key={c.id} label={c.name} sortKey={`col:${c.id}`} active={active} onSort={onSort} />
                ) : (
                  <span key={c.id} role="columnheader" className="truncate">
                    {c.name}
                  </span>
                ),
              )}
              <HeaderButton label="Votes" sortKey="score" active={active} onSort={onSort} />
              <span role="columnheader" aria-label="Comments" />
            </div>
            {items.map((item, i) => (
              <SortableRow key={item.id} id={item.id} disabled={!canDrag}>
                {(handle) => (
                  <div
                    role="row"
                    className="grid items-center gap-3 border-b border-zinc-100 bg-white px-3 py-2 last:border-b-0 dark:border-zinc-900 dark:bg-zinc-950"
                    style={{ gridTemplateColumns }}
                  >
                    {canDrag && handle}
                    <span role="cell" className="text-right text-sm text-zinc-400 tabular-nums">
                      {i + 1}
                    </span>
                    <div role="cell" className="min-w-0">
                      <button
                        type="button"
                        onClick={() => onOpen(item)}
                        className="text-left font-medium break-words hover:underline"
                      >
                        {item.title}
                      </button>
                      <p className="text-xs text-zinc-500">{addedBy(item, names)}</p>
                    </div>
                    {columns.map((c) => (
                      <div role="cell" key={c.id} className="min-w-0 text-sm">
                        <FieldValue column={c} value={item.fields[c.id]} clamp />
                      </div>
                    ))}
                    <div role="cell" className="flex gap-1">
                      <Votes item={item} onVote={onVote} />
                    </div>
                    <div role="cell">
                      <CommentButton item={item} onOpen={onOpen} />
                    </div>
                  </div>
                )}
              </SortableRow>
            ))}
          </div>
        </div>,
      )}

      {sortable(
        /* Mobile: cards */
        <ol className="space-y-2 md:hidden">
          {items.map((item, i) => (
            <SortableRow key={item.id} id={item.id} disabled={!canDrag} as="li">
              {(handle) => (
                <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
                  <div className="flex items-start gap-2">
                    {canDrag && handle}
                    <span className="w-5 shrink-0 pt-0.5 text-right text-sm text-zinc-400 tabular-nums">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => onOpen(item)}
                        className="text-left font-medium break-words hover:underline"
                      >
                        {item.title}
                      </button>
                      <p className="text-xs text-zinc-500">{addedBy(item, names)}</p>
                    </div>
                  </div>
                  {columns.some((c) => item.fields[c.id] !== undefined) && (
                    <dl className="mt-2 space-y-1 pl-7 text-sm">
                      {columns
                        .filter((c) => item.fields[c.id] !== undefined)
                        .map((c) => (
                          <div key={c.id} className="flex gap-2">
                            <dt className="shrink-0 text-zinc-500">{c.name}:</dt>
                            <dd className="min-w-0">
                              <FieldValue column={c} value={item.fields[c.id]} clamp />
                            </dd>
                          </div>
                        ))}
                    </dl>
                  )}
                  <div className="mt-3 flex items-center gap-2 pl-7">
                    <Votes item={item} onVote={onVote} />
                    <span className="flex-1" />
                    <CommentButton item={item} onOpen={onOpen} />
                  </div>
                </div>
              )}
            </SortableRow>
          ))}
        </ol>,
      )}
    </>
  );
}

export function SortableRow({
  id,
  disabled,
  as: Tag = "div",
  children,
}: {
  id: string;
  disabled: boolean;
  as?: "div" | "li";
  children: (handle: React.ReactNode) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  });

  const handle = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      aria-label="Drag to reorder"
      className="cursor-grab touch-none rounded px-1 text-zinc-400 hover:bg-zinc-100 active:cursor-grabbing dark:hover:bg-zinc-800"
    >
      ⠿
    </button>
  );

  return (
    <Tag
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? "relative z-10 opacity-80 shadow-lg" : undefined}
    >
      {children(handle)}
    </Tag>
  );
}

function HeaderButton({
  label,
  sortKey,
  active,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  active: Sort;
  onSort: (key: SortKey) => void;
}) {
  const isActive = active.key === sortKey;
  const arrow = isActive ? (active.dir === "asc" ? " ↑" : " ↓") : "";
  return (
    <span role="columnheader" aria-sort={isActive ? (active.dir === "asc" ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`truncate text-left uppercase hover:text-zinc-900 dark:hover:text-zinc-100 ${isActive ? "text-zinc-900 dark:text-zinc-100" : ""}`}
      >
        {label}
        {arrow}
      </button>
    </span>
  );
}

export function FieldValue({ column, value, clamp }: { column: Column; value: unknown; clamp?: boolean }) {
  if (value === undefined || value === null || value === "") return <span className="text-zinc-400">—</span>;
  if (column.type === "boolean") return <span>{value === true ? "Yes" : "No"}</span>;
  return (
    <span className={`whitespace-pre-wrap break-words ${clamp ? "line-clamp-2" : ""}`}>
      <Linkify text={String(value)} />
    </span>
  );
}

export function Votes({ item, onVote }: { item: Item; onVote: (item: Item, value: 1 | -1) => void }) {
  return (
    <>
      <VoteButton
        label="Thumbs up"
        emoji="👍"
        count={item.up}
        active={item.myVote === 1}
        onClick={() => onVote(item, 1)}
      />
      <VoteButton
        label="Thumbs down"
        emoji="👎"
        count={item.down}
        active={item.myVote === -1}
        onClick={() => onVote(item, -1)}
      />
    </>
  );
}

function VoteButton(props: { label: string; emoji: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={`${props.label} (${props.count})`}
      aria-pressed={props.active}
      onClick={props.onClick}
      className={`inline-flex min-w-12 items-center justify-center gap-1 rounded-lg border px-2 py-1 text-sm tabular-nums transition ${
        props.active
          ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
          : "border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
      }`}
    >
      <span aria-hidden>{props.emoji}</span>
      {props.count}
    </button>
  );
}

function CommentButton({ item, onOpen }: { item: Item; onOpen: (item: Item) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      aria-label={`${item.commentCount} ${item.commentCount === 1 ? "comment" : "comments"}`}
      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-zinc-500 tabular-nums hover:bg-zinc-100 dark:hover:bg-zinc-800"
    >
      <span aria-hidden>💬</span>
      {item.commentCount}
    </button>
  );
}

function addedBy(item: Item, names: Map<string, string>) {
  return item.createdBy && names.has(item.createdBy) ? `added by ${names.get(item.createdBy)}` : "added";
}
