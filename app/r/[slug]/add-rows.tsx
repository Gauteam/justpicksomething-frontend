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

type Props = {
  slug: string;
  token: string;
  columns: Column[];
  onAdded: () => Promise<void>;
};

// State for the new-option row(s). Starts as one row; pasting rows copied from
// a spreadsheet (tab-separated, one per line) fills cells from where you paste
// and adds rows as needed. Submitting adds every row with a title.
function useNewRows({ slug, token, columns, onAdded }: Props) {
  const [rows, setRows] = useState<Row[]>(() => [blankRow()]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const firstInput = useRef<HTMLInputElement>(null);

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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
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
      firstInput.current?.focus();
    } catch (err) {
      setError(errorMessage(err, "Couldn't add that."));
    } finally {
      setBusy(false);
    }
  }

  const submitLabel = busy ? "Adding…" : filled.length > 1 ? `Add ${filled.length}` : "Add";

  return { rows, filled, busy, message, error, firstInput, setCell, onPaste, removeRow, onSubmit, submitLabel };
}

function CellInput({
  column,
  value,
  label,
  onChange,
  onPaste,
}: {
  column: Column;
  value: string;
  label: string;
  onChange: (v: string) => void;
  onPaste: (e: React.ClipboardEvent) => void;
}) {
  if (column.type === "boolean") {
    return (
      <select aria-label={label} className={cellClass} value={value} onChange={(e) => onChange(e.target.value)}>
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
      onChange={(e) => onChange(e.target.value)}
      onPaste={onPaste}
    />
  );
}

// Input row(s) at the bottom of the comparison table, lined up with its
// columns. `lead` is how many table columns come before Option; the Add
// button sits there.
export function AddRowsTable(props: Props & { gridTemplateColumns: string; lead: number }) {
  const { columns, gridTemplateColumns, lead } = props;
  const s = useNewRows(props);
  const span = { gridColumn: `span ${lead} / span ${lead}` };

  return (
    <form onSubmit={s.onSubmit} role="rowgroup" aria-label="New option" className="bg-zinc-50 dark:bg-zinc-900/60">
      {s.rows.map((row, ri) => (
        <div
          key={ri}
          role="row"
          className="grid items-center gap-3 border-t border-zinc-200 px-3 py-2 dark:border-zinc-800"
          style={{ gridTemplateColumns }}
        >
          <div role="cell" style={span}>
            {ri === 0 ? (
              <button
                type="submit"
                className={`${primaryButtonClass} w-full py-1.5`}
                disabled={s.busy || !s.filled.length}
              >
                {s.submitLabel}
              </button>
            ) : (
              <button
                type="button"
                aria-label={`Remove row ${ri + 1}`}
                onClick={() => s.removeRow(ri)}
                className="w-full rounded px-1 py-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
              >
                ×
              </button>
            )}
          </div>
          <div role="cell">
            <input
              ref={ri === 0 ? s.firstInput : undefined}
              aria-label={`New option${s.rows.length > 1 ? `, row ${ri + 1}` : ""}`}
              placeholder={ri === 0 ? "Add an option…" : undefined}
              className={cellClass}
              value={row.title}
              maxLength={200}
              onChange={(e) => s.setCell(ri, "title", e.target.value)}
              onPaste={(e) => s.onPaste(e, ri, 0)}
            />
          </div>
          {columns.map((c, ci) => (
            <div role="cell" key={c.id}>
              <CellInput
                column={c}
                label={`${c.name}${s.rows.length > 1 ? `, row ${ri + 1}` : ""}`}
                value={row.fields[c.id] ?? ""}
                onChange={(v) => s.setCell(ri, c.id, v)}
                onPaste={(e) => s.onPaste(e, ri, ci + 1)}
              />
            </div>
          ))}
          <div role="cell" />
        </div>
      ))}
      <div className="px-3 pb-2 text-xs text-zinc-500" style={{ gridColumn: "1 / -1" }}>
        {s.error ? <span className={errorClass}>{s.error}</span> : (s.message ?? HELP)}
      </div>
    </form>
  );
}

// Phone version: the same inputs as a card under the option cards.
export function AddRowsCards(props: Props) {
  const { columns } = props;
  const s = useNewRows(props);

  return (
    <form onSubmit={s.onSubmit} aria-label="New option" className="space-y-2">
      {s.rows.map((row, ri) => (
        <div key={ri} className="space-y-2 rounded-xl border border-dashed border-zinc-300 p-3 dark:border-zinc-700">
          <div className="flex gap-2">
            <input
              ref={ri === 0 ? s.firstInput : undefined}
              aria-label={`New option${s.rows.length > 1 ? `, row ${ri + 1}` : ""}`}
              placeholder="Add an option…"
              className={cellClass}
              value={row.title}
              maxLength={200}
              onChange={(e) => s.setCell(ri, "title", e.target.value)}
              onPaste={(e) => s.onPaste(e, ri, 0)}
            />
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
                  <CellInput
                    column={c}
                    label={`${c.name}${s.rows.length > 1 ? `, row ${ri + 1}` : ""}`}
                    value={row.fields[c.id] ?? ""}
                    onChange={(v) => s.setCell(ri, c.id, v)}
                    onPaste={(e) => s.onPaste(e, ri, ci + 1)}
                  />
                </label>
              ))}
            </div>
          )}
        </div>
      ))}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-zinc-500">
          {s.error ? <span className={errorClass}>{s.error}</span> : (s.message ?? HELP)}
        </p>
        <button type="submit" className={`${primaryButtonClass} shrink-0`} disabled={s.busy || !s.filled.length}>
          {s.submitLabel}
        </button>
      </div>
    </form>
  );
}
