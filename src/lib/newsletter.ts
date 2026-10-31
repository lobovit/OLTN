import type { NewsletterSource, Status } from "../api/types";

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
];

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
