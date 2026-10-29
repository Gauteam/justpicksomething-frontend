"use client";

import Link from "next/link";
import { useState } from "react";
import {
  addItems,
  ApiError,
  clearVote,
  errorMessage,
  reorderItems,
  setVote,
  splitTitles,
  type Column,
  type Item,
  type RoomData,
} from "@/lib/api";
import { effectiveSort, isSortable, loadSort, nextSort, saveSort, sortItems, type Sort } from "@/lib/sort";
import { useRoomSession } from "@/lib/session";
import { useRoom } from "@/lib/use-room";
import { ShareCard } from "@/components/share-card";
import { errorClass, inputClass, primaryButtonClass, secondaryButtonClass } from "@/components/styles";
import { ColumnsPanel } from "./columns-panel";
import { ItemList } from "./item-list";
import { ItemPanel } from "./item-panel";
import { JoinForm } from "./join-form";

export function RoomView({ slug }: { slug: string }) {
  const session = useRoomSession(slug);
  const { data, setData, error, refresh } = useRoom(slug, session?.token ?? null);

  if (session === undefined) return <Loading />;
  if (session === null) return <JoinForm slug={slug} />;
  if (!data) return error ? <p className={errorClass}>{error}</p> : <Loading />;

  return (
    <Room
      slug={slug}
      token={session.token}
      passcode={session.passcode}
      data={data}
      setData={setData}
      error={error}
      refresh={refresh}
    />
  );
}

export function Loading() {
  return <p className="text-zinc-500">Loading…</p>;
}

type RoomProps = {
  slug: string;
  token: string;
  passcode?: string;
  data: RoomData;
  setData: React.Dispatch<React.SetStateAction<RoomData | null>>;
  error: string | null;
  refresh: () => Promise<void>;
};

function Room({ slug, token, passcode, data, setData, error, refresh }: RoomProps) {
  const [showInvite, setShowInvite] = useState(false);
  const [showColumns, setShowColumns] = useState(false);
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>(() => loadSort(slug));
  const [actionError, setActionError] = useState<string | null>(null);

  const names = new Map(data.members.map((m) => [m.id, m.displayName]));
  const active = effectiveSort(sort, data.columns);
  const items = sortItems(data.items, data.columns, active);
  const openItem = data.items.find((i) => i.id === openItemId);
  const isAdmin = data.me.isAdmin;

  function changeSort(next: Sort) {
    setSort(next);
    saveSort(slug, next);
  }

  async function vote(item: Item, value: 1 | -1) {
    const next = item.myVote === value ? 0 : value;
    // Optimistic update; the refresh below brings the authoritative tallies.
    setData((d) => d && { ...d, items: d.items.map((it) => (it.id === item.id ? applyVote(it, next) : it)) });
    setActionError(null);
    try {
      if (next === 0) await clearVote(slug, token, item.id);
      else await setVote(slug, token, item.id, next);
    } catch (err) {
      setActionError(errorMessage(err, "Couldn't save your vote."));
    }
    await refresh();
  }

  async function reorder(ids: string[]) {
    const position = new Map(ids.map((id, i) => [id, i + 1]));
    setData(
      (d) => d && { ...d, items: d.items.map((it) => ({ ...it, position: position.get(it.id) ?? it.position })) },
    );
    setActionError(null);
    try {
      await reorderItems(slug, token, ids);
    } catch (err) {
      setActionError(errorMessage(err, "Couldn't save the new order."));
    }
    await refresh();
  }

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Link href="/" className="text-sm text-zinc-500 hover:underline">
              Just Pick Something
            </Link>
            <h1 className="text-2xl font-semibold tracking-tight break-words">{data.room.name}</h1>
          </div>
          <button type="button" className={secondaryButtonClass} onClick={() => setShowInvite((v) => !v)}>
            {showInvite ? "Close" : "Invite"}
          </button>
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {data.members.length} {data.members.length === 1 ? "person" : "people"}:{" "}
          {data.members.map((m) => (m.id === data.me.id ? `${m.displayName} (you)` : m.displayName)).join(", ")}
        </p>
        {showInvite && <ShareCard slug={slug} roomName={data.room.name} passcode={passcode} />}
      </header>

      <div className="max-w-2xl">
        <AddItemForm slug={slug} token={token} onAdded={refresh} />
      </div>

      {(actionError || error) && <p className={errorClass}>{actionError ?? error}</p>}

      {data.items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-zinc-500 dark:border-zinc-700">
          Nothing here yet. Add the first option above.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SortSelect sort={active} columns={data.columns} onChange={changeSort} />
            {isAdmin && (
              <button type="button" className={secondaryButtonClass} onClick={() => setShowColumns(true)}>
                Columns{data.columns.length > 0 ? ` (${data.columns.length})` : ""}
              </button>
            )}
          </div>
          {isAdmin && active.key !== "manual" && (
            <p className="text-xs text-zinc-500">Switch to “Manual order” to drag options into place.</p>
          )}
          <ItemList
            items={items}
            columns={data.columns}
            names={names}
            sort={active}
            canDrag={isAdmin && active.key === "manual"}
            onSort={(key) => changeSort(nextSort(active, key))}
            onVote={vote}
            onOpen={(item) => setOpenItemId(item.id)}
            onReorder={reorder}
          />
        </div>
      )}

      {data.items.length === 0 && isAdmin && (
        <button type="button" className={secondaryButtonClass} onClick={() => setShowColumns(true)}>
          Set up columns
        </button>
      )}

      <div className="max-w-2xl">
        <BulkAddForm slug={slug} token={token} onAdded={refresh} />
      </div>

      {openItem && (
        <ItemPanel
          key={openItem.id}
          slug={slug}
          token={token}
          item={openItem}
          columns={data.columns}
          members={data.members}
          me={data.me}
          roomUpdatedAt={data.room.updatedAt}
          onVote={vote}
          onChanged={refresh}
          onClose={() => setOpenItemId(null)}
        />
      )}
      {showColumns && isAdmin && (
        <ColumnsPanel
          slug={slug}
          token={token}
          columns={data.columns}
          onChanged={refresh}
          onClose={() => setShowColumns(false)}
        />
      )}
    </div>
  );
}

function SortSelect({ sort, columns, onChange }: { sort: Sort; columns: Column[]; onChange: (s: Sort) => void }) {
  const options: { label: string; sort: Sort }[] = [
    { label: "Most votes", sort: { key: "score", dir: "desc" } },
    { label: "Fewest votes", sort: { key: "score", dir: "asc" } },
    { label: "Manual order", sort: { key: "manual", dir: "asc" } },
    { label: "Name A–Z", sort: { key: "title", dir: "asc" } },
    { label: "Name Z–A", sort: { key: "title", dir: "desc" } },
    { label: "Oldest first", sort: { key: "created", dir: "asc" } },
    { label: "Newest first", sort: { key: "created", dir: "desc" } },
    ...columns.filter(isSortable).flatMap((c) => [
      { label: `${c.name} ↑`, sort: { key: `col:${c.id}` as const, dir: "asc" as const } },
      { label: `${c.name} ↓`, sort: { key: `col:${c.id}` as const, dir: "desc" as const } },
    ]),
  ];
  const value = `${sort.key}|${sort.dir}`;

  return (
    <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
      Sort
      <select
        className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        value={value}
        onChange={(e) => {
          const picked = options.find((o) => `${o.sort.key}|${o.sort.dir}` === e.target.value);
          if (picked) onChange(picked.sort);
        }}
      >
        {options.map((o) => (
          <option key={`${o.sort.key}|${o.sort.dir}`} value={`${o.sort.key}|${o.sort.dir}`}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function applyVote(item: Item, next: number): Item {
  let { up, down } = item;
  if (item.myVote === 1) up--;
  if (item.myVote === -1) down--;
  if (next === 1) up++;
  if (next === -1) down++;
  return { ...item, up, down, score: up - down, myVote: next };
}

function AddItemForm({ slug, token, onAdded }: { slug: string; token: string; onAdded: () => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const added = await addItems(slug, token, [title]);
      if (added.length === 0) {
        setError("That's already in the list.");
        return;
      }
      setTitle("");
      await onAdded();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't add that.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-1">
      <div className="flex gap-2">
        <label htmlFor="new-item" className="sr-only">
          New option
        </label>
        <input
          id="new-item"
          className={inputClass}
          placeholder="Add an option…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
        />
        <button type="submit" className={primaryButtonClass} disabled={busy || !title.trim()}>
          Add
        </button>
      </div>
      {error && <p className={errorClass}>{error}</p>}
    </form>
  );
}

function BulkAddForm({ slug, token, onAdded }: { slug: string; token: string; onAdded: () => Promise<void> }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const titles = splitTitles(text);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (titles.length === 0) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const added = await addItems(slug, token, titles);
      const skipped = titles.length - added.length;
      setMessage(
        `Added ${added.length} ${added.length === 1 ? "option" : "options"}.` +
          (skipped > 0 ? ` Skipped ${skipped} already in the list.` : ""),
      );
      setText("");
      await onAdded();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't add those.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2 border-t border-zinc-200 pt-6 dark:border-zinc-800">
      <label htmlFor="bulk-items" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Add several at once
      </label>
      <textarea
        id="bulk-items"
        className={`${inputClass} min-h-28`}
        placeholder={"One per line, or separated by commas:\nLake house, Cabin, Beach condo"}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-zinc-500" aria-live="polite">
          {titles.length > 50
            ? "50 at most at a time."
            : titles.length > 0
              ? `${titles.length} ${titles.length === 1 ? "option" : "options"}`
              : ""}
        </p>
        <button
          type="submit"
          className={primaryButtonClass}
          disabled={busy || titles.length === 0 || titles.length > 50}
        >
          {busy ? "Adding…" : titles.length > 0 ? `Add ${titles.length}` : "Add"}
        </button>
      </div>
      {message && <p className="text-sm text-zinc-600 dark:text-zinc-400">{message}</p>}
      {error && <p className={errorClass}>{error}</p>}
    </form>
  );
}
