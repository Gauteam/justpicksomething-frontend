"use client";

import { useRef, useState } from "react";

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
import type { Column, Item, VoteMode } from "@/lib/api";
import { effectiveSort, isSortable, type Sort, type SortKey } from "@/lib/sort";
import { Linkify } from "@/components/linkify";

type Props = {
  items: Item[];
  columns: Column[];
  names: Map<string, string>;
  sort: Sort;
  canDrag: boolean;
  onSort: (key: SortKey) => void;
  voting: Voting;
  // Highlighted rows (the top pick once the room is locked in).
  highlight: Set<string>;
  onOpen: (item: Item) => void;
  onReorder: (ids: string[]) => void;
  // Rendered inside the table under the last row (the new-option input row),
  // given the table's track sizes and how many columns come before Option.
  footer?: (grid: { gridTemplateColumns: string; lead: number }) => React.ReactNode;
  // Beside the table on its right, lined up with the bottom row (the + button).
  aside?: React.ReactNode;
  // Saves a value edited in place in the table; absent = read-only (locked).
  onEditField?: (item: Item, column: Column, value: string | boolean | null) => Promise<void>;
};

export function ItemList({
  items,
  columns,
  names,
  sort,
  canDrag,
  onSort,
  voting,
  highlight,
  onOpen,
  onReorder,
  footer,
  aside,
  onEditField,
}: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const active = effectiveSort(sort, columns);

  // Same track sizes for the header and every row so the "table" lines up.
  // Rank, votes and comments come first so they're always in view, even
  // when columns scroll.
  const gridTemplateColumns = [
    "2rem",
    voting.mode === "budget" && voting.allowDuplicates ? "8rem" : "7rem",
    "3.5rem",
    canDrag ? "2rem" : null,
    "minmax(12rem, 2fr)",
    ...columns.map((c) =>
      c.type === "boolean" ? "6rem" : c.type === "textarea" ? "minmax(12rem, 2fr)" : "minmax(8rem, 1fr)",
    ),
  ]
    .filter(Boolean)
    .join(" ");
  // Columns before Option: #, votes, comments, drag handle (if any).
  const lead = canDrag ? 4 : 3;

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
        <div className="hidden items-end gap-3 md:flex">
          <div className="min-w-0 flex-1 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <div className="min-w-max" role="table" aria-label="Options">
              <div
                role="row"
                className="grid items-center gap-3 border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium tracking-wide text-zinc-500 uppercase dark:border-zinc-800 dark:bg-zinc-900"
                style={{ gridTemplateColumns }}
              >
                <span role="columnheader">#</span>
                <HeaderButton label="Votes" sortKey="score" active={active} onSort={onSort} />
                <span role="columnheader" aria-label="Comments" />
                {canDrag && <span role="columnheader" aria-label="Reorder" />}
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
              </div>
              {items.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-zinc-500">
                  Nothing here yet. Add the first option below.
                </p>
              )}
              {items.map((item, i) => (
                <SortableRow key={item.id} id={item.id} disabled={!canDrag}>
                  {(handle) => (
                    <div
                      role="row"
                      className={`grid items-center gap-3 border-b border-zinc-100 px-3 py-2 last:border-b-0 dark:border-zinc-900 ${
                        highlight.has(item.id) ? "bg-amber-50 dark:bg-amber-950/40" : "bg-white dark:bg-zinc-950"
                      }`}
                      style={{ gridTemplateColumns }}
                    >
                      <span role="cell" className="text-right text-sm text-zinc-400 tabular-nums">
                        {i + 1}
                      </span>
                      <div role="cell" className="flex gap-1">
                        <Votes item={item} voting={voting} />
                      </div>
                      <div role="cell">
                        <CommentButton item={item} onOpen={onOpen} />
                      </div>
                      {canDrag && handle}
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
                          {onEditField ? (
                            <EditableField
                              column={c}
                              value={item.fields[c.id]}
                              onSave={(v) => onEditField(item, c, v)}
                            />
                          ) : (
                            <FieldValue column={c} value={item.fields[c.id]} clamp />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </SortableRow>
              ))}
              {footer?.({ gridTemplateColumns, lead })}
            </div>
          </div>
          {aside && <div className="mb-2 shrink-0">{aside}</div>}
        </div>,
      )}

      {sortable(
        /* Mobile: cards */
        <ol className="space-y-2 md:hidden">
          {items.map((item, i) => (
            <SortableRow key={item.id} id={item.id} disabled={!canDrag} as="li">
              {(handle) => (
                <div
                  className={`rounded-xl border p-3 ${
                    highlight.has(item.id)
                      ? "border-amber-400 bg-amber-50 dark:border-amber-600 dark:bg-amber-950/40"
                      : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
                  }`}
                >
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
                              {/* Tapping a value opens the item's editor. */}
                              <button type="button" onClick={() => onOpen(item)} className="text-left">
                                <FieldValue column={c} value={item.fields[c.id]} clamp />
                              </button>
                            </dd>
                          </div>
                        ))}
                    </dl>
                  )}
                  <div className="mt-3 flex items-center gap-2 pl-7">
                    <Votes item={item} voting={voting} />
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

const editClass =
  "w-full min-w-0 rounded-md border border-zinc-400 bg-white px-2 py-1 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-300";

// A table cell value you can click to edit in place. Text saves on Enter or
// when you click away (Escape cancels); long text saves on Ctrl/Cmd+Enter or
// click-away; yes/no saves as soon as you pick.
function EditableField({
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
  // Enter commits and unmounts the input, which can also fire blur; only the
  // first close counts.
  const closed = useRef(false);
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
    if (next.trim() === current) return;
    const v = next.trim();
    onSave(v === "" ? null : column.type === "boolean" ? v === "yes" : v);
  }

  if (!editing) {
    return (
      <div
        role="button"
        tabIndex={0}
        aria-label={`Edit ${column.name}`}
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

  if (column.type === "textarea") {
    return (
      <textarea
        ref={(el) => el?.focus()}
        aria-label={column.name}
        className={`${editClass} min-h-16`}
        value={draft}
        maxLength={2000}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => commit(draft)}
        onKeyDown={(e) => {
          if (e.key === "Escape") cancel();
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) commit(draft);
        }}
      />
    );
  }

  return (
    <input
      ref={(el) => el?.focus()}
      aria-label={column.name}
      className={editClass}
      value={draft}
      maxLength={200}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => commit(draft)}
      onKeyDown={(e) => {
        if (e.key === "Escape") cancel();
        if (e.key === "Enter" && !e.nativeEvent.isComposing) commit(draft);
      }}
    />
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

// Everything the vote controls need about the room and the viewer.
export type Voting = {
  mode: VoteMode;
  allowDuplicates: boolean;
  // Budget mode: votes the viewer hasn't placed yet.
  votesLeft: number;
  locked: boolean;
  // Sets the viewer's vote on an item to `next` (0 clears it).
  onVote: (item: Item, next: number) => void;
};

export function Votes({ item, voting }: { item: Item; voting: Voting }) {
  const { mode, allowDuplicates, votesLeft, locked, onVote } = voting;

  if (mode === "thumbs") {
    return (
      <>
        <VoteButton
          label="Thumbs up"
          content={
            <>
              <span aria-hidden>👍</span>
              {item.up}
            </>
          }
          active={item.myVote === 1}
          disabled={locked}
          onClick={() => onVote(item, item.myVote === 1 ? 0 : 1)}
        />
        <VoteButton
          label="Thumbs down"
          content={
            <>
              <span aria-hidden>👎</span>
              {item.down}
            </>
          }
          active={item.myVote === -1}
          disabled={locked}
          onClick={() => onVote(item, item.myVote === -1 ? 0 : -1)}
        />
      </>
    );
  }

  const total = `${item.up} ${item.up === 1 ? "vote" : "votes"}`;
  if (!allowDuplicates) {
    const voted = item.myVote > 0;
    return (
      <VoteButton
        label={voted ? `Remove your vote (${total})` : `Vote (${total})`}
        content={
          <>
            {voted ? "✓" : "+"} {item.up}
          </>
        }
        active={voted}
        disabled={locked || (!voted && votesLeft <= 0)}
        onClick={() => onVote(item, voted ? 0 : 1)}
      />
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <VoteButton
        label="Take back a vote"
        content="−"
        active={false}
        disabled={locked || item.myVote <= 0}
        onClick={() => onVote(item, item.myVote - 1)}
      />
      <span className="min-w-12 text-center text-sm tabular-nums" aria-label={`${total}, ${item.myVote} yours`}>
        {item.up}
        {item.myVote > 0 && <span className="text-zinc-500"> ({item.myVote})</span>}
      </span>
      <VoteButton
        label="Add a vote"
        content="+"
        active={false}
        disabled={locked || votesLeft <= 0}
        onClick={() => onVote(item, item.myVote + 1)}
      />
    </span>
  );
}

function VoteButton(props: {
  label: string;
  content: React.ReactNode;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={props.label}
      aria-pressed={props.active}
      disabled={props.disabled}
      onClick={props.onClick}
      className={`inline-flex min-w-10 items-center justify-center gap-1 rounded-lg border px-2 py-1 text-sm tabular-nums transition disabled:cursor-not-allowed disabled:opacity-50 ${
        props.active
          ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
          : "border-zinc-300 enabled:hover:bg-zinc-100 dark:border-zinc-700 dark:enabled:hover:bg-zinc-800"
      }`}
    >
      {props.content}
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
