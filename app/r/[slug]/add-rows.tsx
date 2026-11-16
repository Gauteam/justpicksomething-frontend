"use client";

import { useRef, useState } from "react";
import { addItems, errorMessage, linkTitle, type Column, type NewItem } from "@/lib/api";
import { AutoTextarea } from "@/components/auto-textarea";
import { isUrl, nameFromLink } from "@/components/link-badge";
import { errorClass, labelClass, primaryButtonClass } from "@/components/styles";
import ChevronRight from "@mui/icons-material/ChevronRight";
import Close from "@mui/icons-material/Close";
import Add from "@mui/icons-material/Add";

const MAX_ROWS = 50;

// One option being typed: its name plus a raw string per column (booleans as
// "" / "yes" / "no").
type Row = { title: string; fields: Record<string, string> };

const blankRow = (): Row => ({ title: "", fields: {} });

const inputClass =
  "w-full min-w-0 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-300";

// Accepts what people type or paste for a yes/no column.
function parseBoolean(s: string): string {
  const v = s.trim().toLowerCase();
  if (["yes", "y", "true", "1", "✓", "x"].includes(v)) return "yes";
  if (["no", "n", "false", "0"].includes(v)) return "no";
  return "";
}

// The column a pasted link belongs in: the first short-text column named like
// a link (Link, Listing, Menu, Website…).
function findLinkColumn(columns: Column[]): Column | undefined {
  return columns.find((c) => c.type === "text" && /link|listing|url|menu|website|booking|site/i.test(c.name));
}

type Props = {
  slug: string;
  token: string;
  columns: Column[];
  // Titles already in the room, so fallback names don't collide.
  existingTitles: string[];
  // Start expanded (e.g. a room with no options yet).
  defaultOpen: boolean;
  onAdded: () => Promise<void>;
};

// The add-option form above the table. Starts as one option; pasting rows
// copied from a spreadsheet (tab-separated, one per line) fills more.
export function AddOptionForm({ slug, token, columns, existingTitles, defaultOpen, onAdded }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  // Like GitHub's "Create more": keep the form open for the next one.
  const [addAnother, setAddAnother] = useState(false);
  const [rows, setRows] = useState<Row[]>(() => [blankRow()]);
  const [busy, setBusy] = useState(false);
  const [fetching, setFetching] = useState<Set<number>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const firstInput = useRef<HTMLTextAreaElement | null>(null);
  // Page titles already asked for, by URL (shared by typing and submitting).
  const titleCache = useRef(new Map<string, Promise<string | null>>());

  const linkColumn = findLinkColumn(columns);
  const hasContent = (r: Row) => r.title.trim() !== "" || Object.values(r.fields).some((v) => v.trim() !== "");
  const filled = rows.filter(hasContent);
  // Cell positions: 0 is the name, then one per column.
  const keys = ["title", ...columns.map((c) => c.id)];

  function titleFor(url: string) {
    let p = titleCache.current.get(url);
    if (!p) {
      p = linkTitle(slug, token, url);
      titleCache.current.set(url, p);
    }
    return p;
  }

  // A link went into row `ri`: fetch its page title and use it as the name if
  // the name is still empty when it arrives.
  function fillTitleFromLink(ri: number, url: string) {
    setFetching((f) => new Set(f).add(ri));
    titleFor(url).then((title) => {
      setFetching((f) => {
        const next = new Set(f);
        next.delete(ri);
        return next;
      });
      if (!title) return;
      // Fill an empty name, or replace a link left in the name box.
      setRows((rs) =>
        rs.map((r, i) => (i === ri && (r.title.trim() === "" || r.title.trim() === url) ? { ...r, title } : r)),
      );
    });
  }

  function setCell(ri: number, key: string, value: string) {
    setMessage(null);
    setError(null);
    // A link typed or pasted as the name moves to the link column, and the
    // page title becomes the name.
    if (key === "title" && linkColumn && isUrl(value)) {
      const url = value.trim();
      setRows((rs) => rs.map((r, i) => (i === ri ? { title: "", fields: { ...r.fields, [linkColumn.id]: url } } : r)));
      fillTitleFromLink(ri, url);
      return;
    }
    setRows((rs) =>
      rs.map((r, i) =>
        i !== ri ? r : key === "title" ? { ...r, title: value } : { ...r, fields: { ...r.fields, [key]: value } },
      ),
    );
    const col = columns.find((c) => c.id === key);
    if (col?.type === "text" && isUrl(value) && rows[ri]?.title.trim() === "") fillTitleFromLink(ri, value.trim());
    if (key === "title" && !linkColumn && isUrl(value)) fillTitleFromLink(ri, value.trim());
  }

  function onPaste(e: React.ClipboardEvent, ri: number, colIndex: number) {
    const text = e.clipboardData.getData("text/plain");
    if (!/[\t\n]/.test(text)) return; // a plain single value: normal paste
    e.preventDefault();
    const lines = text.replace(/\r\n?/g, "\n").replace(/\n+$/, "").split("\n");

    setMessage(null);
    setRows((rs) => {
      const next = [...rs];
      lines.slice(0, MAX_ROWS - ri).forEach((line, li) => {
        const r = ri + li;
        const row = next[r] ? { ...next[r], fields: { ...next[r].fields } } : blankRow();
        line.split("\t").forEach((cell, ci) => {
          const key = keys[colIndex + ci];
          if (!key) return;
          if (key === "title") row.title = cell.trim();
          else {
            const col = columns.find((c) => c.id === key);
            row.fields[key] = col?.type === "boolean" ? parseBoolean(cell) : cell.trim();
          }
        });
        next[r] = row;
      });
      return next;
    });
  }

  function removeRow(index: number) {
    setRows((rs) => (rs.length === 1 ? [blankRow()] : rs.filter((_, i) => i !== index)));
  }

  // The name for a row: what was typed, else the page title of its link, else
  // a name made from the link, else "Untitled option" (numbered so names stay
  // unique, since the room skips duplicate names).
  async function nameFor(row: Row, taken: Set<string>): Promise<string> {
    const pick = (base: string) => {
      let name = base;
      for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${base} ${n}`;
      taken.add(name.toLowerCase());
      return name;
    };
    if (row.title.trim()) {
      taken.add(row.title.trim().toLowerCase());
      return row.title.trim();
    }
    const url = Object.entries(row.fields).find(
      ([id, v]) => columns.find((c) => c.id === id)?.type === "text" && isUrl(v),
    )?.[1];
    if (url) return pick((await titleFor(url.trim())) ?? nameFromLink(url));
    return pick("Untitled option");
  }

  async function submit() {
    if (filled.length === 0 || busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const taken = new Set(existingTitles.map((t) => t.toLowerCase()));
      const items: NewItem[] = [];
      for (const r of filled) {
        const fields: Record<string, string | boolean> = {};
        for (const c of columns) {
          const v = (r.fields[c.id] ?? "").trim();
          if (v) fields[c.id] = c.type === "boolean" ? v === "yes" : v;
        }
        items.push({ title: await nameFor(r, taken), fields });
      }
      const added = await addItems(slug, token, items);
      const skipped = items.length - added.length;
      if (skipped > 0) {
        setMessage(
          added.length === 0
            ? "Already in the list."
            : `Added ${added.length}. Skipped ${skipped} already in the list.`,
        );
      }
      setRows([blankRow()]);
      await onAdded();
      if (addAnother) firstInput.current?.focus();
      else setOpen(false);
    } catch (err) {
      setError(errorMessage(err, "Couldn't add that."));
    } finally {
      setBusy(false);
    }
  }

  // Enter adds (short fields). Long-text fields keep Enter for new lines.
  function onKeyDown(e: React.KeyboardEvent, multiline = false) {
    if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
    if (multiline && !(e.metaKey || e.ctrlKey)) return;
    e.preventDefault();
    submit();
  }

  const n = filled.length;
  return (
    <section aria-label="Add an option" className="rounded-xl border border-zinc-200 dark:border-zinc-800">
      <h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="add-option-body"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-2 px-4 py-3 text-left font-medium"
        >
          <span aria-hidden className={`inline-block text-zinc-400 transition-transform ${open ? "rotate-90" : ""}`}>
            <ChevronRight fontSize="inherit" />
          </span>
          Add an option
        </button>
      </h2>
      {open && (
        <div id="add-option-body" className="space-y-3 border-t border-zinc-200 p-3 dark:border-zinc-800">
          {rows.map((row, ri) => (
            <div key={ri} className="flex items-start gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
              <div className="min-w-0 flex-1 space-y-2">
                <AutoTextarea
                  ref={ri === 0 ? firstInput : undefined}
                  aria-label={`Option name${rows.length > 1 ? `, row ${ri + 1}` : ""}`}
                  placeholder={fetching.has(ri) ? "Getting the page title…" : "Add an option: a name, or paste a link"}
                  className={`${inputClass} text-base`}
                  value={row.title}
                  maxLength={200}
                  onChange={(e) => setCell(ri, "title", e.target.value)}
                  onPaste={(e) => onPaste(e, ri, 0)}
                  onKeyDown={(e) => onKeyDown(e)}
                />
                {columns.length > 0 && (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-2">
                    {columns.map((c, ci) => (
                      <label key={c.id} className="block min-w-0">
                        <span className={`${labelClass} text-xs`}>{c.name}</span>
                        {c.type === "boolean" ? (
                          <select
                            className={inputClass}
                            value={row.fields[c.id] ?? ""}
                            onChange={(e) => setCell(ri, c.id, e.target.value)}
                          >
                            <option value="">—</option>
                            <option value="yes">Yes</option>
                            <option value="no">No</option>
                          </select>
                        ) : (
                          <AutoTextarea
                            className={inputClass}
                            value={row.fields[c.id] ?? ""}
                            maxLength={c.type === "textarea" ? 2000 : 200}
                            onChange={(e) => setCell(ri, c.id, e.target.value)}
                            onPaste={(e) => onPaste(e, ri, ci + 1)}
                            onKeyDown={(e) => onKeyDown(e, c.type === "textarea")}
                          />
                        )}
                      </label>
                    ))}
                  </div>
                )}
              </div>
              {ri > 0 && (
                <button
                  type="button"
                  aria-label={`Remove row ${ri + 1}`}
                  onClick={() => removeRow(ri)}
                  className="h-10 min-w-10 shrink-0 rounded text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
                >
                  <Close fontSize="small" />
                </button>
              )}
            </div>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-prose text-xs text-zinc-500" aria-live="polite">
              {error ? <span className={errorClass}>{error}</span> : message}
            </p>
            <div className="ml-auto flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
                <input type="checkbox" checked={addAnother} onChange={(e) => setAddAnother(e.target.checked)} />
                Add another
              </label>
              <button
                type="button"
                onClick={submit}
                disabled={busy || n === 0}
                aria-label={n > 1 ? `Add ${n} options` : "Add option"}
                title={n > 1 ? `Add ${n} options` : "Add option"}
                className={`${primaryButtonClass} h-10 min-w-10 gap-1 px-3 text-lg leading-none`}
              >
                <Add fontSize="small" aria-hidden />
                {n > 1 && <span className="text-sm tabular-nums">{n}</span>}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
