"use client";

import { useState } from "react";
import { errorMessage, removeMember, resetPasscode, setMemberAdmin, type Member, type Room } from "@/lib/api";
import { updateSession } from "@/lib/session";
import { Panel } from "@/components/panel";
import { errorClass, secondaryButtonClass } from "@/components/styles";
import { useConfirm } from "@/components/confirm-dialog";

type Props = {
  slug: string;
  token: string;
  room: Room;
  members: Member[];
  me: Member;
  onChanged: () => Promise<void>;
  onClose: () => void;
};

// Everyone sees who's in the room; admins can promote, demote and remove
// people and change the passcode.
export function MembersPanel({ slug, token, room, members, me, onChanged, onClose }: Props) {
  const confirm = useConfirm();
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [newPasscode, setNewPasscode] = useState<string | null>(null);
  const locked = room.lockedAt !== null;

  async function run(id: string, action: () => Promise<unknown>, fallback: string) {
    setBusyId(id);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(errorMessage(err, fallback));
    }
    setBusyId(null);
    await onChanged();
  }

  async function onRemove(m: Member) {
    const self = m.id === me.id;
    const who = self ? "yourself" : m.displayName;
    const ok = await confirm(
      self
        ? {
            title: "Leave this room?",
            message: "Your votes and comments will be deleted, and you'll need the passcode to come back.",
            confirmLabel: "Leave room",
            tone: "danger",
          }
        : {
            title: `Remove ${m.displayName}?`,
            message: "Their votes and comments will be deleted. They can rejoin with the passcode.",
            confirmLabel: "Remove",
            tone: "danger",
          },
    );
    if (!ok) return;
    run(m.id, () => removeMember(slug, token, m.id), `Couldn't remove ${who}.`);
  }

  async function onResetPasscode() {
    const ok = await confirm({
      title: "Make a new passcode?",
      message: "People already in the room stay in. The old passcode stops working.",
      confirmLabel: "New passcode",
    });
    if (!ok) return;
    setBusyId("passcode");
    setError(null);
    try {
      const res = await resetPasscode(slug, token);
      updateSession(slug, { passcode: res.passcode, passcodeChangedAt: res.passcodeChangedAt });
      setNewPasscode(res.passcode);
      await onChanged();
    } catch (err) {
      setError(errorMessage(err, "Couldn't change the passcode."));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Panel title={`People (${members.length})`} onClose={onClose}>
      <div className="space-y-6">
        {room.everyoneAdmin && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Everyone in this room is an admin.{me.isAdmin && " Change that in Settings."}
          </p>
        )}
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {members.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-2 py-2.5">
              <span className="min-w-0 flex-1 truncate">
                {m.displayName}
                {m.id === me.id && <span className="text-zinc-500"> (you)</span>}
              </span>
              {m.isAdmin && (
                <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  admin
                </span>
              )}
              {me.isAdmin && (
                <span className="flex gap-1.5">
                  <button
                    type="button"
                    className={secondaryButtonClass}
                    disabled={busyId !== null}
                    onClick={() =>
                      run(m.id, () => setMemberAdmin(slug, token, m.id, !m.isAdmin), "Couldn't change that.")
                    }
                  >
                    {m.isAdmin ? "Remove admin" : "Make admin"}
                  </button>
                  <button
                    type="button"
                    className={secondaryButtonClass}
                    disabled={busyId !== null || locked}
                    title={locked ? "Unlock the room to remove people" : undefined}
                    onClick={() => onRemove(m)}
                  >
                    {m.id === me.id ? "Leave" : "Remove"}
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
        {me.isAdmin && locked && <p className="text-xs text-zinc-500">Unlock the room to remove people.</p>}

        {me.isAdmin && (
          <section className="space-y-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <h3 className="font-semibold">Passcode</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Make a new passcode if the old one got shared too widely. Everyone already here stays in.
            </p>
            {newPasscode && (
              <p className="text-sm">
                New passcode: <code className="font-mono text-lg tracking-widest">{newPasscode}</code>
              </p>
            )}
            <button type="button" className={secondaryButtonClass} disabled={busyId !== null} onClick={onResetPasscode}>
              {busyId === "passcode" ? "Changing…" : "New passcode"}
            </button>
          </section>
        )}

        {error && <p className={errorClass}>{error}</p>}
      </div>
    </Panel>
  );
}
