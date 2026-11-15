import type { Member } from "./api";

// Mid-tone colors that read on both light and dark backgrounds.
const PALETTE = ["#e5484d", "#e07a2b", "#b8860b", "#30a46c", "#0d9488", "#3b82f6", "#8b5cf6", "#d6409f"];

// Each member's color, assigned in join order (members come oldest first), so
// the first eight people in a room never share one. Nothing is stored.
export function memberColors(members: Member[]): Map<string, string> {
  return new Map(members.map((m, i) => [m.id, PALETTE[i % PALETTE.length]]));
}
