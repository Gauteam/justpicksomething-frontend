"use client";

import { useState } from "react";
import { addItems, errorMessage, type Column, type NewItem } from "@/lib/api";
import { errorClass, primaryButtonClass, secondaryButtonClass } from "@/components/styles";

const MAX_ROWS = 50;
const START_ROWS = 3;

// One row being typed: the option's title plus a raw string per column
// (booleans as "" / "yes" / "no").
type Row = { title: string; fields: Record<string, string> };

const blankRows = (n: number): Row[] => Array.from({ length: n }, () => ({ title: "", fields: {} }));

const cellClass =
  "w-full min-w-0 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-300";

// Accepts what people type or paste for a yes/no column.
function parseBoolean(s: string): string {
  const v = s.trim().toLowerCase();
  if (["yes", "y", "true", "1", "✓", "x"].includes(v)) return "yes";
  if (["no", "n", "false", "0"].includes(v)) return "no";
  return "";
}

// Add several options at once, in a table with the room's columns. Pasting
// rows copied from a spreadsheet (tab-separated, one per line) fills cells
// starting where you paste and adds rows as needed.
export function BulkAddTable({
  slug,
  token,
  columns,
  onAdded,
}: {
  slug: string;
  token: string;
  columns: Column[];
  onAdded: () => Promise<void>;
}) {
  const [rows, setRows] = useState<Row[]>(() => blankRows(START_ROWS));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filled = rows.filter((r) => r.title.trim());
  // Cell positions: 0 is the title, then one per column.
  const keys = ["title", ...columns.map((c) => c.id)];

  function setCell(rowIndex: number, key: string, value: string) {
    setMessage(null);
    setRows((rs) =>
      rs.map((r, i) =>
        i !== rowIndex ? r : key === "title" ? { ...r, title: value } : { ...r, fields: { ...r.fields, [key]: value } },
      ),
    );
  }

  function onPaste(e: React.ClipboardEvent, rowIndex: number, colIndex: number) {
    const text = e.clipboardData.getData("text/plain");
    if (!/[\t\n]/.test(text)) return; // a plain single value: normal paste
    e.preventDefault();
    const lines = text.replace(/\r\n?/g, "\n").replace(/\n+$/, "").split("\n");

    setMessage(null);
    setRows((rs) => {
      const next = [...rs];
      lines.slice(0, MAX_ROWS - rowIndex).forEach((line, li) => {
        const r = rowIndex + li;
        const row = next[r] ? { ...next[r], fields: { ...next[r].fields } } : { title: "", fields: {} };
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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (filled.length === 0) return;
    const items: NewItem[] = filled.map((r) => {
      const fields: Record<string, string | boolean> = {};
      for (const c of columns) {
        const v = (r.fields[c.id] ?? "").trim();
        if (v) fields[c.id] = c.type === "boolean" ? v === "yes" : v;
      }
      return { title: r.title, fields };
    });

    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const added = await addItems(slug, token, items);
      const skipped = items.length - added.length;
      setMessage(
        `Added ${added.length} ${added.length === 1 ? "option" : "options"}.` +
          (skipped > 0 ? ` Skipped ${skipped} already in the list.` : ""),
      );
      setRows(blankRows(START_ROWS));
      await onAdded();
    } catch (err) {
      setError(errorMessage(err, "Couldn't add those."));
    } finally {
      setBusy(false);
    }
  }

  const gridTemplateColumns = [
    "minmax(10rem, 2fr)",
    ...columns.map((c) =>
      c.type === "boolean" ? "5.5rem" : c.type === "textarea" ? "minmax(10rem, 2fr)" : "minmax(7rem, 1fr)",
    ),
    "2rem",
  ].join(" ");

  return (
    <form onSubmit={onSubmit} className="space-y-3 border-t border-zinc-200 pt-6 dark:border-zinc-800">
      <div>
        <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Add several at once</h2>
        <p className="text-xs text-zinc-500">Fill in rows, or paste rows copied from a spreadsheet.</p>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-max space-y-1.5 md:min-w-0" role="table" aria-label="New options">
          <div
            role="row"
            className="grid gap-2 px-0.5 text-xs font-medium tracking-wide text-zinc-500 uppercase"
            style={{ gridTemplateColumns }}
          >
            <span role="columnheader">Option</span>
            {columns.map((c) => (
              <span role="columnheader" key={c.id} className="truncate">
                {c.name}
              </span>
            ))}
            <span role="columnheader" aria-label="Remove" />
          </div>
          {rows.map((row, ri) => (
            <div role="row" key={ri} className="grid items-start gap-2 px-0.5" style={{ gridTemplateColumns }}>
              <input
                role="cell"
                aria-label={`Option, row ${ri + 1}`}
                className={cellClass}
                value={row.title}
                maxLength={200}
                onChange={(e) => setCell(ri, "title", e.target.value)}
                onPaste={(e) => onPaste(e, ri, 0)}
              />
              {columns.map((c, ci) => {
                const label = `${c.name}, row ${ri + 1}`;
                const value = row.fields[c.id] ?? "";
                if (c.type === "boolean") {
                  return (
                    <select
                      role="cell"
                      key={c.id}
                      aria-label={label}
                      className={cellClass}
                      value={value}
                      onChange={(e) => setCell(ri, c.id, e.target.value)}
                    >
                      <option value="">—</option>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  );
                }
                return (
                  <input
                    role="cell"
                    key={c.id}
                    aria-label={label}
                    className={cellClass}
                    value={value}
                    maxLength={c.type === "textarea" ? 2000 : 200}
                    onChange={(e) => setCell(ri, c.id, e.target.value)}
                    onPaste={(e) => onPaste(e, ri, ci + 1)}
                  />
                );
              })}
              <button
                type="button"
                aria-label={`Remove row ${ri + 1}`}
                className="rounded px-1 py-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-30 dark:hover:bg-zinc-800"
                disabled={rows.length === 1}
                onClick={() => setRows((rs) => rs.filter((_, i) => i !== ri))}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          className={secondaryButtonClass}
          disabled={rows.length >= MAX_ROWS}
          onClick={() => setRows((rs) => [...rs, ...blankRows(1)])}
        >
          + Add row
        </button>
        <button type="submit" className={primaryButtonClass} disabled={busy || filled.length === 0}>
          {busy
            ? "Adding…"
            : filled.length > 0
              ? `Add ${filled.length} ${filled.length === 1 ? "option" : "options"}`
              : "Add options"}
        </button>
      </div>
      {message && <p className="text-sm text-zinc-600 dark:text-zinc-400">{message}</p>}
      {error && <p className={errorClass}>{error}</p>}
    </form>
  );
}
