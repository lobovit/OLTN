/* Pure column layout and positioning helpers. */

import type { Shortcut, ShortcutType } from "../api/types";
import type { TKey } from "../i18n/pt-BR";

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

/** How the home route lays itself out: deck columns, floating panels or a plain page. */
export type RouteMode = "deck" | "floats" | "page";

/** Deck mode: columns. Deck off on desktop: floating panels. Everything else: page. */
export function routeMode(
  path: string,
  authed: boolean,
  deckEnabled: boolean,
  desktop: boolean,
): RouteMode {
  if (!authed || path !== "/") return "page";
  if (deckEnabled) return "deck";
  return desktop ? "floats" : "page";
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

/* ---------------- preset layouts ---------------- */

export interface PresetColumn {
  id: string;
  type: ShortcutType;
  labelKey: TKey;
}

export interface LayoutPreset {
  id: string;
  labelKey: TKey;
  descKey: TKey;
  icon: string;
  columns: readonly PresetColumn[];
}

const STANDARD = {
  home: { id: "home", type: "home", labelKey: "home" },
  notifications: { id: "notifications", type: "notifications", labelKey: "notifications" },
  mentions: { id: "mentions", type: "mentions", labelKey: "mentions" },
  local: { id: "local", type: "local", labelKey: "local" },
  federated: { id: "federated", type: "federated", labelKey: "federated" },
  trending: { id: "trending", type: "trending", labelKey: "trending" },
  bookmarks: { id: "bookmarks", type: "bookmarks", labelKey: "bookmarks" },
  favourites: { id: "favourites", type: "favourites", labelKey: "favourites" },
} satisfies Record<string, PresetColumn>;

export const LAYOUT_PRESETS: readonly LayoutPreset[] = [
  {
    id: "dupla",
    labelKey: "presetDupla",
    descKey: "presetDuplaDesc",
    icon: "home-3-line",
    columns: [STANDARD.home, STANDARD.notifications],
  },
  {
    id: "foco",
    labelKey: "presetFoco",
    descKey: "presetFocoDesc",
    icon: "notification-line",
    columns: [STANDARD.notifications, STANDARD.home],
  },
  {
    id: "curadoria",
    labelKey: "presetCuradoria",
    descKey: "presetCuradoriaDesc",
    icon: "heart-line",
    columns: [STANDARD.home, STANDARD.favourites, STANDARD.bookmarks],
  },
  {
    id: "trio",
    labelKey: "presetTrio",
    descKey: "presetTrioDesc",
    icon: "layout-grid-line",
    columns: [STANDARD.home, STANDARD.notifications, STANDARD.local],
  },
  {
    id: "quadra",
    labelKey: "presetQuadra",
    descKey: "presetQuadraDesc",
    icon: "globe-line",
    columns: [STANDARD.home, STANDARD.notifications, STANDARD.local, STANDARD.federated],
  },
  {
    id: "radar",
    labelKey: "presetRadar",
    descKey: "presetRadarDesc",
    icon: "trending-up-line",
    columns: [STANDARD.trending, STANDARD.local, STANDARD.federated, STANDARD.notifications],
  },
];

/** Builds a layout's columns: preset ones in order, pinned lists/hashtags at the end. */
export function buildLayoutShortcuts(
  preset: LayoutPreset,
  existing: readonly Shortcut[],
): Shortcut[] {
  const customs = existing.filter((s) => s.type === "list" || s.type === "hashtag");
  return [
    ...preset.columns.map((c) => ({ id: c.id, type: c.type, label: c.labelKey })),
    ...customs,
  ];
}
