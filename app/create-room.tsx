"use client";

import Link from "next/link";
import { useState } from "react";
import { ApiError, createRoom } from "@/lib/api";
import { saveSession } from "@/lib/session";
import { ShareCard } from "@/components/share-card";
import { errorClass, inputClass, labelClass, primaryButtonClass } from "@/components/styles";

type Created = { slug: string; name: string; passcode: string };

export function CreateRoom() {
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Created | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await createRoom(name, displayName);
      saveSession(res.slug, { token: res.token, passcode: res.passcode });
      setCreated({ slug: res.slug, name: name.trim(), passcode: res.passcode });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">“{created.name}” is ready</h2>
        <p className="text-zinc-600 dark:text-zinc-400">
          Send the link and passcode to everyone who should pick with you. You can get them again from inside the room.
        </p>
        <ShareCard slug={created.slug} roomName={created.name} passcode={created.passcode} />
        <Link href={`/r/${created.slug}`} className={`${primaryButtonClass} w-full`}>
          Go to room
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="room-name" className={labelClass}>
          What are you picking?
        </label>
        <input
          id="room-name"
          className={inputClass}
          placeholder="Lake trip rental"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          required
        />
      </div>
      <div>
        <label htmlFor="display-name" className={labelClass}>
          Your name
        </label>
        <input
          id="display-name"
          className={inputClass}
          placeholder="Sam"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={40}
          autoComplete="nickname"
          required
        />
      </div>
      {error && <p className={errorClass}>{error}</p>}
      <button type="submit" className={`${primaryButtonClass} w-full`} disabled={busy}>
        {busy ? "Creating…" : "Create room"}
      </button>
    </form>
  );
}
