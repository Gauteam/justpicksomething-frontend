"use client";

import { useRef, useState } from "react";
import { addItems, errorMessage, type Column, type NewItem } from "@/lib/api";
import { errorClass, labelClass, primaryButtonClass } from "@/components/styles";

const MAX_ROWS = 50;

// One row being typed: the option's title plus a raw string per column
// (booleans as "" / "yes" / "no").
type Row = { title: string; fields: Record<string, string> };

const blankRow = (): Row => ({ title: "", fields: {} });

const cellClass =
  "w-full min-w-0 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-300";

const HELP = "Press Enter to add. To add several at once, paste rows copied from a spreadsheet.";

// Accepts what people type or paste for a yes/no column.
function parseBoolean(s: string): string {
  const v = s.trim().toLowerCase();
  if (["yes", "y", "true", "1", "✓", "x"].includes(v)) return "yes";
  if (["no", "n", "false", "0"].includes(v)) return "no";
  return "";
}

export type NewRows = ReturnType<typeof useNewRows>;

// State for the new-option row(s), shared by the table row, the + button
// beside the table and the phone card. Starts as one row; pasting rows copied
// from a spreadsheet (tab-separated, one per line) fills cells from where you
// paste and adds rows as needed. Submitting adds every row with a title.
export function useNewRows({
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
  const [rows, setRows] = useState<Row[]>(() => [blankRow()]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The first title input on desktop and on phones; focus goes back to
  // whichever is visible after adding.
  const firstInputs = useRef<(HTMLInputElement | null)[]>([]);

  const filled = rows.filter((r) => r.title.trim());
  // Cell positions: 0 is the title, then one per column.
  const keys = ["title", ...columns.map((c) => c.id)];

  function setCell(rowIndex: number, key: string, value: string) {
    setMessage(null);
    setError(null);
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

  async function submit() {
    if (filled.length === 0 || busy) return;
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
      if (skipped > 0) {
        setMessage(
          added.length === 0
            ? "Already in the list."
            : `Added ${added.length}. Skipped ${skipped} already in the list.`,
        );
      }
      setRows([blankRow()]);
      await onAdded();
      firstInputs.current.find((el) => el && el.offsetParent !== null)?.focus();
    } catch (err) {
      setError(errorMessage(err, "Couldn't add that."));
    } finally {
      setBusy(false);
    }
  }

  // Enter in any input adds (Escape-free, IME-safe).
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  }

  // Ref setter for the first title input in each layout (0 desktop, 1 phone).
  const firstInputRef = (slot: number) => (el: HTMLInputElement | null) => {
    firstInputs.current[slot] = el;
  };

  return { rows, filled, busy, message, error, firstInputRef, setCell, onPaste, onKeyDown, removeRow, submit };
}

function CellInput({
  s,
  column,
  rowIndex,
  colIndex,
  label,
}: {
  s: NewRows;
  column: Column;
  rowIndex: number;
  colIndex: number;
  label: string;
}) {
  const value = s.rows[rowIndex].fields[column.id] ?? "";
  if (column.type === "boolean") {
    return (
      <select
        aria-label={label}
        className={cellClass}
        value={value}
        onChange={(e) => s.setCell(rowIndex, column.id, e.target.value)}
      >
        <option value="">—</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
    );
  }
  return (
    <input
      aria-label={label}
      className={cellClass}
      value={value}
      maxLength={column.type === "textarea" ? 2000 : 200}
      onChange={(e) => s.setCell(rowIndex, column.id, e.target.value)}
      onPaste={(e) => s.onPaste(e, rowIndex, colIndex)}
      onKeyDown={s.onKeyDown}
    />
  );
}

function TitleInput({ s, rowIndex, slot }: { s: NewRows; rowIndex: number; slot: number }) {
  return (
    <input
      ref={rowIndex === 0 ? s.firstInputRef(slot) : undefined}
      aria-label={`New option${s.rows.length > 1 ? `, row ${rowIndex + 1}` : ""}`}
      placeholder={rowIndex === 0 ? "Add an option…" : undefined}
      className={cellClass}
      value={s.rows[rowIndex].title}
      maxLength={200}
      onChange={(e) => s.setCell(rowIndex, "title", e.target.value)}
      onPaste={(e) => s.onPaste(e, rowIndex, 0)}
      onKeyDown={s.onKeyDown}
    />
  );
}

const rowLabel = (s: NewRows, ri: number, name: string) => `${name}${s.rows.length > 1 ? `, row ${ri + 1}` : ""}`;

// Input row(s) at the bottom of the comparison table, lined up with its
// columns. `lead` is how many table columns come before Option.
export function AddRowsTable({
  s,
  columns,
  gridTemplateColumns,
  lead,
}: {
  s: NewRows;
  columns: Column[];
  gridTemplateColumns: string;
  lead: number;
}) {
  const span = { gridColumn: `span ${lead} / span ${lead}` };
  return (
    <div role="rowgroup" aria-label="New option" className="bg-zinc-50 dark:bg-zinc-900/60">
      {s.rows.map((_, ri) => (
        <div
          key={ri}
          role="row"
          className="grid items-center gap-3 border-t border-zinc-200 px-3 py-2 dark:border-zinc-800"
          style={{ gridTemplateColumns }}
        >
          <div role="cell" style={span} className="text-right">
            {ri > 0 && (
              <button
                type="button"
                aria-label={`Remove row ${ri + 1}`}
                onClick={() => s.removeRow(ri)}
                className="rounded px-2 py-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
              >
                ×
              </button>
            )}
          </div>
          <div role="cell">
            <TitleInput s={s} rowIndex={ri} slot={0} />
          </div>
          {columns.map((c, ci) => (
            <div role="cell" key={c.id}>
              <CellInput s={s} column={c} rowIndex={ri} colIndex={ci + 1} label={rowLabel(s, ri, c.name)} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// The + button that adds the typed row(s).
export function AddButton({ s, className = "" }: { s: NewRows; className?: string }) {
  const n = s.filled.length;
  return (
    <button
      type="button"
      onClick={s.submit}
      disabled={s.busy || n === 0}
      aria-label={n > 1 ? `Add ${n} options` : "Add option"}
      title={n > 1 ? `Add ${n} options` : "Add option"}
      className={`${primaryButtonClass} gap-1 px-3 text-lg leading-none ${className}`}
    >
      <span aria-hidden>+</span>
      {n > 1 && <span className="text-sm tabular-nums">{n}</span>}
    </button>
  );
}

// Help text, or what happened on the last add.
export function AddStatus({ s, className = "" }: { s: NewRows; className?: string }) {
  return (
    <p className={`text-xs text-zinc-500 ${className}`} aria-live="polite">
      {s.error ? <span className={errorClass}>{s.error}</span> : (s.message ?? HELP)}
    </p>
  );
}

// Phone version: the same inputs as a card under the option cards, with the
// + button underneath.
export function AddRowsCards({ s, columns }: { s: NewRows; columns: Column[] }) {
  return (
    <div aria-label="New option" className="space-y-2">
      {s.rows.map((_, ri) => (
        <div key={ri} className="space-y-2 rounded-xl border border-dashed border-zinc-300 p-3 dark:border-zinc-700">
          <div className="flex gap-2">
            <TitleInput s={s} rowIndex={ri} slot={1} />
            {s.rows.length > 1 && (
              <button
                type="button"
                aria-label={`Remove row ${ri + 1}`}
                onClick={() => s.removeRow(ri)}
                className="rounded px-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
              >
                ×
              </button>
            )}
          </div>
          {columns.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {columns.map((c, ci) => (
                <label key={c.id} className="block min-w-0">
                  <span className={`${labelClass} text-xs`}>{c.name}</span>
                  <CellInput s={s} column={c} rowIndex={ri} colIndex={ci + 1} label={rowLabel(s, ri, c.name)} />
                </label>
              ))}
            </div>
          )}
        </div>
      ))}
      <AddButton s={s} className="w-full py-2" />
      <AddStatus s={s} />
    </div>
  );
}
