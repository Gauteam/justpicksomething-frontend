"use client";

import { useState } from "react";
import { ApiError, joinRoom } from "@/lib/api";
import { saveSession } from "@/lib/session";
import { errorClass, inputClass, labelClass, primaryButtonClass } from "@/components/styles";

export function JoinForm({ slug }: { slug: string }) {
  const [passcode, setPasscode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { token } = await joinRoom(slug, passcode, displayName);
      // Saving the session re-renders the room view as joined.
      saveSession(slug, { token, passcode: passcode.replace(/\s+/g, "").toUpperCase() });
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setError("This room doesn't exist. Check the link.");
      } else {
        setError(err instanceof ApiError ? err.message : "Something went wrong.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-semibold tracking-tight">Join this room</h1>
      <p className="mt-2 mb-6 text-zinc-600 dark:text-zinc-400">
        Enter the passcode you were sent and the name others will see.
      </p>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="passcode" className={labelClass}>
            Passcode
          </label>
          <input
            id="passcode"
            className={`${inputClass} font-mono uppercase tracking-widest`}
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            required
          />
        </div>
        <div>
          <label htmlFor="join-name" className={labelClass}>
            Your name
          </label>
          <input
            id="join-name"
            className={inputClass}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={40}
            autoComplete="nickname"
            required
          />
        </div>
        {error && <p className={errorClass}>{error}</p>}
        <button type="submit" className={`${primaryButtonClass} w-full`} disabled={busy}>
          {busy ? "Joining…" : "Join"}
        </button>
      </form>
    </div>
  );
}
