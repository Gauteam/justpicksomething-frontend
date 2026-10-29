"use client";

import Link from "next/link";
import { useState } from "react";
import { addItems, ApiError, clearVote, setVote, splitTitles, type Item, type RoomData } from "@/lib/api";
import { useRoomSession } from "@/lib/session";
import { useRoom } from "@/lib/use-room";
import { ShareCard } from "@/components/share-card";
import { errorClass, inputClass, primaryButtonClass, secondaryButtonClass } from "@/components/styles";
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
  const [actionError, setActionError] = useState<string | null>(null);
  const names = new Map(data.members.map((m) => [m.id, m.displayName]));

  async function vote(item: Item, value: 1 | -1) {
    const next = item.myVote === value ? 0 : value;
    // Optimistic update; the refresh below brings the authoritative tallies
    // and ordering.
    setData((d) => d && { ...d, items: d.items.map((it) => (it.id === item.id ? applyVote(it, next) : it)) });
    setActionError(null);
    try {
      if (next === 0) await clearVote(slug, token, item.id);
      else await setVote(slug, token, item.id, next);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Couldn't save your vote.");
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

      <AddItemForm slug={slug} token={token} onAdded={refresh} />

      {(actionError || error) && <p className={errorClass}>{actionError ?? error}</p>}

      {data.items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-zinc-500 dark:border-zinc-700">
          Nothing here yet. Add the first option above.
        </p>
      ) : (
        <ol className="space-y-2">
          {data.items.map((item, i) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800"
            >
              <span className="w-6 shrink-0 text-right text-sm tabular-nums text-zinc-400">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="break-words font-medium">{item.title}</p>
                <p className="text-xs text-zinc-500">
                  {item.createdBy && names.has(item.createdBy) ? `added by ${names.get(item.createdBy)}` : "added"}
                </p>
              </div>
              <VoteButton
                label="Thumbs up"
                emoji="👍"
                count={item.up}
                active={item.myVote === 1}
                onClick={() => vote(item, 1)}
              />
              <VoteButton
                label="Thumbs down"
                emoji="👎"
                count={item.down}
                active={item.myVote === -1}
                onClick={() => vote(item, -1)}
              />
            </li>
          ))}
        </ol>
      )}

      <BulkAddForm slug={slug} token={token} onAdded={refresh} />
    </div>
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

function VoteButton(props: { label: string; emoji: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={`${props.label} (${props.count})`}
      aria-pressed={props.active}
      onClick={props.onClick}
      className={`inline-flex min-w-14 items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-sm tabular-nums transition ${
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
