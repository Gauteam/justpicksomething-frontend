"use client";

import { useState } from "react";
import { errorMessage, updateSettings, type Room, type SettingsPatch, type VoteMode } from "@/lib/api";
import { Panel } from "@/components/panel";
import { errorClass, inputClass, labelClass, primaryButtonClass } from "@/components/styles";

type Props = {
  slug: string;
  token: string;
  room: Room;
  onChanged: () => Promise<void>;
  onClose: () => void;
};

// Admin-only room settings. Locking and unlocking live in the room header.
export function SettingsPanel({ slug, token, room, onChanged, onClose }: Props) {
  const [name, setName] = useState(room.name);
  const [maxItems, setMaxItems] = useState(room.maxItems?.toString() ?? "");
  const [voteMode, setVoteMode] = useState<VoteMode>(room.voteMode);
  const [votesPerMember, setVotesPerMember] = useState(room.votesPerMember.toString());
  const [allowDuplicates, setAllowDuplicates] = useState(room.allowDuplicateVotes);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patch: SettingsPatch = {};
  if (name.trim() !== room.name) patch.name = name.trim();
  const max = maxItems.trim() === "" ? null : Number(maxItems);
  if (max !== room.maxItems) patch.maxItems = max;
  if (voteMode !== room.voteMode) patch.voteMode = voteMode;
  if (voteMode === "budget") {
    if (Number(votesPerMember) !== room.votesPerMember) patch.votesPerMember = Number(votesPerMember);
    if (allowDuplicates !== room.allowDuplicateVotes) patch.allowDuplicateVotes = allowDuplicates;
  }
  const dirty = Object.keys(patch).length > 0;
  const invalid =
    !name.trim() ||
    (max !== null && (!Number.isInteger(max) || max < 1)) ||
    (voteMode === "budget" &&
      (!Number.isInteger(Number(votesPerMember)) || Number(votesPerMember) < 1 || Number(votesPerMember) > 100));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!dirty || invalid) return;
    if (patch.voteMode && !window.confirm("Changing the voting style clears everyone's votes. Continue?")) return;
    if (
      patch.allowDuplicateVotes === false &&
      !window.confirm("Anyone with several votes on one option will keep just one. Continue?")
    )
      return;
    setBusy(true);
    setError(null);
    try {
      await updateSettings(slug, token, patch);
      await onChanged();
      onClose();
    } catch (err) {
      setError(errorMessage(err, "Couldn't save settings."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Room settings" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <label htmlFor="settings-name" className={labelClass}>
            Room name
          </label>
          <input
            id="settings-name"
            className={inputClass}
            value={name}
            maxLength={100}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div>
          <label htmlFor="settings-max" className={labelClass}>
            Max options
          </label>
          <input
            id="settings-max"
            type="number"
            min={1}
            inputMode="numeric"
            className={inputClass}
            placeholder="No limit"
            value={maxItems}
            onChange={(e) => setMaxItems(e.target.value)}
          />
          <p className="mt-1 text-xs text-zinc-500">Leave empty for no limit.</p>
        </div>

        <fieldset className="space-y-2">
          <legend className={labelClass}>Voting</legend>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              name="vote-mode"
              className="mt-1"
              checked={voteMode === "thumbs"}
              onChange={() => setVoteMode("thumbs")}
            />
            <span>
              <span className="font-medium">Thumbs up / down</span>
              <span className="block text-zinc-500">Everyone can 👍 or 👎 every option.</span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              name="vote-mode"
              className="mt-1"
              checked={voteMode === "budget"}
              onChange={() => setVoteMode("budget")}
            />
            <span>
              <span className="font-medium">Limited votes</span>
              <span className="block text-zinc-500">Everyone gets a set number of votes to spread across options.</span>
            </span>
          </label>
        </fieldset>

        {voteMode === "budget" && (
          <div className="space-y-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
            <div>
              <label htmlFor="settings-votes" className={labelClass}>
                Votes per person
              </label>
              <input
                id="settings-votes"
                type="number"
                min={1}
                max={100}
                inputMode="numeric"
                className={inputClass}
                value={votesPerMember}
                onChange={(e) => setVotesPerMember(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={allowDuplicates} onChange={(e) => setAllowDuplicates(e.target.checked)} />
              Allow more than one vote on the same option
            </label>
          </div>
        )}

        {patch.voteMode && (
          <p className="text-sm text-amber-700 dark:text-amber-400">Changing the voting style clears all votes.</p>
        )}
        {error && <p className={errorClass}>{error}</p>}
        <button type="submit" className={primaryButtonClass} disabled={busy || !dirty || invalid}>
          {busy ? "Saving…" : "Save settings"}
        </button>
      </form>
    </Panel>
  );
}
