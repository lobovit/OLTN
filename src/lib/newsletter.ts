import type { Status } from "../api/types";

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
