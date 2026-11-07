"use client";

import Link from "next/link";
import { useState } from "react";
import { createRoom, errorMessage } from "@/lib/api";
import { saveSession } from "@/lib/session";
import { TEMPLATES, type Template } from "@/lib/templates";
import { ShareCard } from "@/components/share-card";
import { errorClass, inputClass, labelClass, primaryButtonClass } from "@/components/styles";

type Created = { slug: string; name: string; passcode: string };

const CUSTOM = "custom";

const typeHint = { text: "", boolean: "yes / no", textarea: "long text" } as const;

const defaultsFor = (t: Template | undefined) =>
  Object.fromEntries((t?.columns ?? []).map((c) => [c.name, c.checked])) as Record<string, boolean>;

// "I want to decide on…" → room name and your name → Create room. Templates
// pre-create columns; Advanced options lets people pick which.
export function CreateRoom() {
  const [choice, setChoice] = useState("");
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Created | null>(null);

  const template = TEMPLATES.find((t) => t.id === choice);
  const columns = (template?.columns ?? []).filter((c) => checked[c.name]);

  function choose(id: string) {
    const next = TEMPLATES.find((t) => t.id === id);
    // Swap in the template's suggested name unless they've typed their own.
    if (!name.trim() || name === template?.roomName) setName(next?.roomName ?? "");
    setChoice(id);
    setChecked(defaultsFor(next));
    setShowAdvanced(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await createRoom(
        name,
        displayName,
        columns.map((c) => ({ name: c.name, type: c.type })),
      );
      saveSession(res.slug, { token: res.token, passcode: res.passcode, name: name.trim() });
      setCreated({ slug: res.slug, name: name.trim(), passcode: res.passcode });
    } catch (err) {
      setError(errorMessage(err, "Something went wrong."));
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
        <label htmlFor="decide-on" className="mb-2 block text-lg font-medium">
          I want to decide on…
        </label>
        <select
          id="decide-on"
          className={`${inputClass} py-3 text-lg`}
          value={choice}
          onChange={(e) => choose(e.target.value)}
        >
          <option value="" disabled>
            Choose one
          </option>
          {TEMPLATES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
          <option value={CUSTOM}>Custom</option>
        </select>
      </div>

      {choice && (
        <>
          <div>
            <label htmlFor="room-name" className={labelClass}>
              Room name
            </label>
            <input
              id="room-name"
              className={inputClass}
              placeholder="e.g. Movie night"
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

          {template && showAdvanced && (
            <fieldset id="advanced-options" className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
              <legend className="px-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Columns to compare ({columns.length})
              </legend>
              <div className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
                {template.columns.map((c) => (
                  <label key={c.name} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={!!checked[c.name]}
                      onChange={(e) => setChecked((ch) => ({ ...ch, [c.name]: e.target.checked }))}
                    />
                    {c.name}
                    {typeHint[c.type] && <span className="text-xs text-zinc-500">{typeHint[c.type]}</span>}
                  </label>
                ))}
              </div>
              <p className="mt-2 text-xs text-zinc-500">You can add, rename or remove columns later.</p>
            </fieldset>
          )}

          {error && <p className={errorClass}>{error}</p>}

          <div className="flex items-center justify-between gap-4">
            {template ? (
              <button
                type="button"
                aria-expanded={showAdvanced}
                aria-controls="advanced-options"
                onClick={() => setShowAdvanced((v) => !v)}
                className="text-sm text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-400"
              >
                {showAdvanced ? "Hide advanced options" : "Advanced options"}
              </button>
            ) : (
              <span />
            )}
            <button type="submit" className={`${primaryButtonClass} px-6 py-2.5`} disabled={busy}>
              {busy ? "Creating…" : "Create room"}
            </button>
          </div>
        </>
      )}
    </form>
  );
}
