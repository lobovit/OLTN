import type { NewsletterSource, Status } from "../api/types";

const EARLY_DEFAULT_ACCTS = new Set([
  "icnoticias.com.br@rss-parrot.net",
  "jornalpublicobot@mastodon.world",
  "flipboardbr@flipboard.com",
]);

const ADDED_DEFAULT_SOURCES: readonly NewsletterSource[] = [
  {
    id: "",
    acct: "teiadospovos@kolektiva.social",
    name: "teiadospovos",
  },
  {
    id: "",
    acct: "noticiasbrasil@mastodon.social",
    name: "noticiasbrasil",
  },
];

/** Bumped when new default sources should reach accounts that already seeded the old set. */
export const NEWSLETTER_DEFAULTS_VERSION = 2;

/** Sources every account starts with; ids are filled by the Newsletter page. */
export const DEFAULT_NEWSLETTER_SOURCES: readonly NewsletterSource[] = [
  {
    id: "",
    acct: "icnoticias.com.br@rss-parrot.net",
    name: "icnoticias.com.br",
  },
  {
    id: "",
    acct: "jornalpublicobot@mastodon.world",
    name: "jornalpublicobot",
  },
  {
    id: "",
    acct: "FlipboardBR@flipboard.com",
    name: "FlipboardBR",
  },
  ...ADDED_DEFAULT_SOURCES,
];

/** Adds newly shipped defaults to a seeded list without reviving removed sources. */
export function addDefaultNewsletterSources(
  current: readonly NewsletterSource[],
  version: number | undefined,
): NewsletterSource[] {
  if (version != null && version >= NEWSLETTER_DEFAULTS_VERSION) return [...current];
  if (!current.some((source) => EARLY_DEFAULT_ACCTS.has(source.acct.toLowerCase()))) {
    return [...current];
  }
  const seen = new Set(current.map((source) => source.acct.toLowerCase()));
  const next = [...current];
  for (const source of ADDED_DEFAULT_SOURCES) {
    if (seen.has(source.acct.toLowerCase())) continue;
    seen.add(source.acct.toLowerCase());
    next.push({ ...source });
  }
  return next;
}

/** Fills unresolved sources in place, ignoring accounts the user removed. */
export function mergeResolvedSources(
  current: readonly NewsletterSource[],
  resolved: readonly NewsletterSource[],
): NewsletterSource[] {
  if (!resolved.length) return [...current];
  const byAcct = new Map(resolved.map((source) => [source.acct.toLowerCase(), source]));
  return current.map(
    (source) => (source.id ? source : byAcct.get(source.acct.toLowerCase())) ?? source,
  );
}

/** Merges source timelines into one list: newest first, no duplicates. */
export function newestFirst(lists: readonly Status[][], limit = 40): Status[] {
  const seen = new Set<string>();
  const merged: Status[] = [];
  for (const list of lists) {
    for (const status of list) {
      const key = status.uri || status.id;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(status);
    }
  }
  return merged.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, limit);
}
