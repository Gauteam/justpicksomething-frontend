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
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";
import type { Column, Item, VoteMode } from "@/lib/api";
import { AutoTextarea } from "@/components/auto-textarea";
import { Menu } from "@/components/menu";
import { Cell, FieldValue, editClass } from "./fields";
import { AddColumnButton, RowLabel } from "./row-labels";

export { FieldValue };

type Props = {
  slug: string;
  token: string;
  items: Item[];
  columns: Column[];
  names: Map<string, string>;
  canDrag: boolean;
  voting: Voting;
  // Highlighted options (the top pick once the room is locked in).
  highlight: Set<string>;
  // Admin and unlocked: values, names and rows can be changed in the table.
  editable: boolean;
  onOpen: (item: Item) => void;
  // Opens one cell's comment thread.
  onOpenCell: (item: Item, column: Column) => void;
  onReorder: (ids: string[]) => void;
  onEditField: (item: Item, column: Column, value: string | boolean | null) => Promise<void>;
  onRename: (item: Item, title: string) => Promise<void>;
  onDelete: (item: Item) => void;
  onColumnsChanged: () => Promise<void>;
  onError: (message: string | null) => void;
};

// The comparison table, flipped: each option is a column (its name, rank,
// votes and comments at the top) and each detail is a row. On desktop it fits
// the page width; phones get one card per option instead.
export function ItemList(props: Props) {
  const { items, columns, canDrag, voting, highlight, editable, onReorder } = props;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const ids = items.map((i) => i.id);
    onReorder(arrayMove(ids, ids.indexOf(String(e.active.id)), ids.indexOf(String(e.over.id))));
  }

  // Row labels, then one equal share of the remaining width per option.
  const gridTemplateColumns = `minmax(6rem, 10rem) repeat(${items.length}, minmax(0, 1fr))`;
  const cellBg = (item: Item) => (highlight.has(item.id) ? "bg-amber-50 dark:bg-amber-950/40" : "");
  const manage = {
    slug: props.slug,
    token: props.token,
    columns,
    onChanged: props.onColumnsChanged,
    onError: props.onError,
  };

  return (
    <>
      {/* Desktop: options side by side */}
      <div className="hidden md:block">
        <div
          role="table"
          aria-label="Options"
          className="grid rounded-xl border border-zinc-200 dark:border-zinc-800"
          style={{ gridTemplateColumns }}
        >
          <div role="row" className="contents">
            <div role="columnheader" className="border-b border-zinc-200 p-3 dark:border-zinc-800" />
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={items.map((i) => i.id)} strategy={horizontalListSortingStrategy}>
                {items.map((item, i) => (
                  <Sortable key={item.id} id={item.id} disabled={!canDrag}>
                    {(handle) => (
                      <div
                        role="columnheader"
                        className={`h-full space-y-2 border-b border-l border-zinc-200 p-3 dark:border-zinc-800 ${cellBg(item)}`}
                      >
                        <OptionHeading {...props} item={item} rank={i + 1} handle={canDrag ? handle : null} />
                        <div className="flex flex-wrap items-center gap-1">
                          <Votes item={item} voting={voting} />
                          <CommentButton item={item} onOpen={props.onOpen} />
                        </div>
                      </div>
                    )}
                  </Sortable>
                ))}
              </SortableContext>
            </DndContext>
          </div>
          {columns.map((c, ci) => (
            <div role="row" key={c.id} className="contents">
              <div
                role="rowheader"
                className={`p-3 ${ci < columns.length - 1 ? "border-b border-zinc-100 dark:border-zinc-900" : ""}`}
              >
                <RowLabel {...manage} column={c} editable={editable} />
              </div>
              {items.map((item) => (
                <div
                  role="cell"
                  key={item.id}
                  className={`min-w-0 border-l border-zinc-200 p-3 text-sm dark:border-zinc-800 ${
                    ci < columns.length - 1 ? "border-b border-b-zinc-100 dark:border-b-zinc-900" : ""
                  } ${cellBg(item)}`}
                >
                  <Cell
                    column={c}
                    value={item.fields[c.id]}
                    onSave={editable ? (v) => props.onEditField(item, c, v) : undefined}
                    commentCount={item.cellComments?.[c.id] ?? 0}
                    onComment={() => props.onOpenCell(item, c)}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
        {editable && (
          <div className="mt-2">
            <AddColumnButton {...manage} />
          </div>
        )}
      </div>

      {/* Phones: one card per option */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <ol className="space-y-2 md:hidden">
            {items.map((item, i) => (
              <Sortable key={item.id} id={item.id} disabled={!canDrag} as="li">
                {(handle) => (
                  <div
                    className={`space-y-2 rounded-xl border p-3 ${
                      highlight.has(item.id)
                        ? "border-amber-400 bg-amber-50 dark:border-amber-600 dark:bg-amber-950/40"
                        : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
                    }`}
                  >
                    <OptionHeading {...props} item={item} rank={i + 1} handle={canDrag ? handle : null} />
                    <div className="flex items-center gap-1">
                      <Votes item={item} voting={voting} />
                      <CommentButton item={item} onOpen={props.onOpen} />
                    </div>
                    {columns.some((c) => item.fields[c.id] !== undefined) && (
                      <dl className="space-y-1 text-sm">
                        {columns
                          .filter((c) => item.fields[c.id] !== undefined)
                          .map((c) => (
                            <div key={c.id} className="flex gap-2">
                              <dt className="shrink-0 text-zinc-500">{c.name}:</dt>
                              <dd className="min-w-0">
                                {/* Tapping a value opens the option's details. */}
                                <button type="button" onClick={() => props.onOpen(item)} className="text-left">
                                  <FieldValue column={c} value={item.fields[c.id]} clamp />
                                </button>
                                {(item.cellComments?.[c.id] ?? 0) > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => props.onOpenCell(item, c)}
                                    aria-label={`${item.cellComments[c.id]} comments on ${c.name}`}
                                    className="ml-1 text-xs text-zinc-500 tabular-nums"
                                  >
                                    💬 {item.cellComments[c.id]}
                                  </button>
                                )}
                              </dd>
                            </div>
                          ))}
                      </dl>
                    )}
                  </div>
                )}
              </Sortable>
            ))}
          </ol>
        </SortableContext>
      </DndContext>
      {editable && (
        <div className="md:hidden">
          <AddColumnButton {...manage} />
        </div>
      )}
    </>
  );
}

// An option's rank and name, with its ⋯ menu (Rename, Details, Delete) for
// admins. Clicking the name opens the details panel.
function OptionHeading({
  item,
  rank,
  handle,
  names,
  editable,
  onOpen,
  onRename,
  onDelete,
}: Props & { item: Item; rank: number; handle: React.ReactNode }) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(item.title);

  function commit() {
    setRenaming(false);
    const t = draft.trim();
    if (t && t !== item.title) onRename(item, t);
    else setDraft(item.title);
  }

  return (
    <div className="flex items-start gap-1.5">
      {handle}
      <span className="pt-0.5 text-xs text-zinc-400 tabular-nums">#{rank}</span>
      <div className="min-w-0 flex-1">
        {renaming ? (
          <AutoTextarea
            ref={(el) => el?.focus()}
            aria-label={`Rename ${item.title}`}
            className={editClass}
            value={draft}
            maxLength={200}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              }
              if (e.key === "Escape") {
                setDraft(item.title);
                setRenaming(false);
              }
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => onOpen(item)}
            className="text-left font-semibold break-words hover:underline"
          >
            {item.title}
          </button>
        )}
        <p className="text-xs text-zinc-500">{addedBy(item, names)}</p>
      </div>
      {editable && !renaming && (
        <Menu
          label={`${item.title} options`}
          items={[
            {
              label: "Rename",
              onSelect: () => {
                setDraft(item.title);
                setRenaming(true);
              },
            },
            { label: "Details & comments", onSelect: () => onOpen(item) },
            { label: "Delete", onSelect: () => onDelete(item), danger: true },
          ]}
        />
      )}
    </div>
  );
}

function Sortable({
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
