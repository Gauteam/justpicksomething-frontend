import type { Column, Item } from "./api";

// Each viewer's own sort, kept in localStorage per room. Column keys are
// "col:<id>".
export type SortKey = "score" | "manual" | "title" | "created" | `col:${string}`;
export type SortDir = "asc" | "desc";
export type Sort = { key: SortKey; dir: SortDir };

export const DEFAULT_SORT: Sort = { key: "score", dir: "desc" };

const storageKey = (slug: string) => `jps:sort:${slug}`;

export function loadSort(slug: string): Sort {
  try {
    const raw = localStorage.getItem(storageKey(slug));
    return raw ? (JSON.parse(raw) as Sort) : DEFAULT_SORT;
  } catch {
    return DEFAULT_SORT;
  }
}

export function saveSort(slug: string, sort: Sort) {
  try {
    localStorage.setItem(storageKey(slug), JSON.stringify(sort));
  } catch {
    // Sort just won't be remembered.
  }
}

// Columns that can be sorted on. Long text isn't.
export const isSortable = (c: Column) => c.type !== "textarea";

// Falls back to the default when the sort's column was deleted or became
// unsortable.
export function effectiveSort(sort: Sort, columns: Column[]): Sort {
  if (!sort.key.startsWith("col:")) return sort;
  const col = columns.find((c) => `col:${c.id}` === sort.key);
  return col && isSortable(col) ? sort : DEFAULT_SORT;
}

// Header click cycle: ascending → descending → manual order. Votes start
// descending (most votes first).
export function nextSort(current: Sort, key: SortKey): Sort {
  const first: SortDir = key === "score" ? "desc" : "asc";
  if (current.key !== key) return { key, dir: first };
  if (current.dir === first) return { key, dir: first === "asc" ? "desc" : "asc" };
  return { key: "manual", dir: "asc" };
}

// Natural, case-insensitive: "2" before "10", "a" equals "A".
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

const byManual = (a: Item, b: Item) => a.position - b.position || a.createdAt.localeCompare(b.createdAt);

export function sortItems(items: Item[], columns: Column[], sort: Sort): Item[] {
  const { key, dir } = effectiveSort(sort, columns);
  const sign = dir === "asc" ? 1 : -1;
  const sorted = [...items];

  if (key === "manual") return sorted.sort(byManual);
  if (key === "score") return sorted.sort((a, b) => sign * (a.score - b.score) || byManual(a, b));
  if (key === "title") return sorted.sort((a, b) => sign * collator.compare(a.title, b.title) || byManual(a, b));
  if (key === "created") return sorted.sort((a, b) => sign * a.createdAt.localeCompare(b.createdAt) || byManual(a, b));

  const colId = key.slice("col:".length);
  return sorted.sort((a, b) => {
    const av = a.fields[colId];
    const bv = b.fields[colId];
    // Empty values always last, whatever the direction.
    if (av === undefined || bv === undefined) {
      return (av === undefined ? 1 : 0) - (bv === undefined ? 1 : 0) || byManual(a, b);
    }
    // Booleans: yes first when ascending.
    const cmp =
      typeof av === "boolean" || typeof bv === "boolean"
        ? Number(bv === true) - Number(av === true)
        : collator.compare(String(av), String(bv));
    return sign * cmp || byManual(a, b);
  });
}
