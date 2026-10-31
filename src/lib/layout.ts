/* Pure column layout and positioning helpers. */

import type { LayoutMode, Shortcut } from "../api/types";

export const COLUMN_MIN = 240;
export const COLUMN_MAX = 720;
/** Maximum columns rendered in the deck. */
export const COLUMN_LIMIT = 6;

export function clampNumber(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function clampWidth(width: number): number {
  return clampNumber(Math.round(width), COLUMN_MIN, COLUMN_MAX);
}

/** Orders items by id; ids missing from order keep their original order at the end. */
export function orderColumns<T extends { id: string }>(
  items: readonly T[],
  order: readonly string[],
): T[] {
  if (!order.length) return [...items];
  const rank = new Map(order.map((id, i) => [id, i]));
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const ra = rank.get(a.item.id) ?? Number.MAX_SAFE_INTEGER;
      const rb = rank.get(b.item.id) ?? Number.MAX_SAFE_INTEGER;
      return ra - rb || a.index - b.index;
    })
    .map((entry) => entry.item);
}

/** How the shell lays itself out. */
export type RouteMode = "deck" | "floats" | "social" | "page";

/** Reads the layout setting, migrating the old `deckMode` boolean. */
export function layoutFromSettings(
  raw: { layout?: unknown; deckMode?: unknown },
  fallback: LayoutMode = "columns",
): LayoutMode {
  if (raw.layout === "columns" || raw.layout === "floats" || raw.layout === "social") {
    return raw.layout;
  }
  return raw.deckMode === false ? "floats" : fallback;
}

/** Desktop keeps the chosen layout; phones always get a single-column page. */
export function routeMode(
  path: string,
  authed: boolean,
  layout: LayoutMode,
  desktop: boolean,
): RouteMode {
  if (!authed || !desktop) return "page";
  if (layout === "social") return "social";
  if (path !== "/") return "page";
  return layout === "columns" ? "deck" : "floats";
}

/** Moves `id` before/after `targetId` in a list of ids. */
export function moveInOrder(
  ids: readonly string[],
  id: string,
  targetId: string,
  side: "before" | "after",
): string[] {
  const rest = ids.filter((x) => x !== id);
  const at = rest.indexOf(targetId);
  if (at === -1) return [...ids];
  rest.splice(side === "before" ? at : at + 1, 0, id);
  return rest;
}

/** Ensures the column is among the first `limit` ones (visible area),
    moving it to the last visible position when needed. */
export function ensureColumnVisible(
  shortcuts: readonly Shortcut[],
  shortcut: Shortcut,
  limit = COLUMN_LIMIT,
): Shortcut[] {
  const next = shortcuts.some((s) => s.id === shortcut.id)
    ? [...shortcuts]
    : [...shortcuts, shortcut];
  const index = next.findIndex((s) => s.id === shortcut.id);
  if (index >= limit) {
    next.splice(index, 1);
    next.splice(limit - 1, 0, shortcut);
  }
  return next;
}
