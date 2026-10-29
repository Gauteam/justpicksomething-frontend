"use client";

import { useState } from "react";
import { roomLink } from "@/lib/session";
import { secondaryButtonClass } from "./styles";

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked; the value is still visible to copy by hand.
    }
  }

  return (
    <button type="button" onClick={copy} className={secondaryButtonClass}>
      {copied ? "Copied" : label}
    </button>
  );
}

export function ShareCard({ slug, roomName, passcode }: { slug: string; roomName: string; passcode?: string }) {
  const link = roomLink(slug);
  const invite = passcode
    ? `Join "${roomName}" on Just Pick Something: ${link}\nPasscode: ${passcode}`
    : `Join "${roomName}" on Just Pick Something: ${link}`;

  return (
    <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Link</p>
        <div className="mt-1 flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate font-mono text-sm">{link}</code>
          <CopyButton text={link} label="Copy" />
        </div>
      </div>
      {passcode && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Passcode</p>
          <div className="mt-1 flex items-center gap-2">
            <code className="flex-1 font-mono text-lg tracking-widest">{passcode}</code>
            <CopyButton text={passcode} label="Copy" />
          </div>
        </div>
      )}
      <CopyButton text={invite} label="Copy invite message" />
    </div>
  );
}
