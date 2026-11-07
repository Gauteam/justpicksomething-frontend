"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, joinRoom } from "@/lib/api";
import { parseRoomCode, saveSession } from "@/lib/session";
import { errorClass, inputClass, labelClass, primaryButtonClass } from "@/components/styles";

// Join an existing room from the home page with its link or code.
export function JoinRoom() {
  const router = useRouter();
  const [room, setRoom] = useState("");
  const [passcode, setPasscode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const slug = parseRoomCode(room);
    if (!slug) {
      setError("That doesn't look like a room link or code.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { token } = await joinRoom(slug, passcode, displayName);
      saveSession(slug, {
        token,
        passcode: passcode.replace(/\s+/g, "").toUpperCase(),
      });
      router.push(`/r/${slug}`);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 404
          ? "No room with that link or code."
          : err instanceof ApiError
            ? err.message
            : "Something went wrong.",
      );
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="join-room" className={labelClass}>
          Room link or code
        </label>
        <input
          id="join-room"
          className={inputClass}
          placeholder="pick.rajwalgautam.com/r/… or the code"
          value={room}
          onChange={(e) => setRoom(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          required
        />
      </div>
      <div>
        <label htmlFor="join-passcode" className={labelClass}>
          Passcode
        </label>
        <input
          id="join-passcode"
          className={`${inputClass} font-mono tracking-widest uppercase`}
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          required
        />
      </div>
      <div>
        <label htmlFor="join-display-name" className={labelClass}>
          Your name
        </label>
        <input
          id="join-display-name"
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
        {busy ? "Joining…" : "Join room"}
      </button>
    </form>
  );
}
