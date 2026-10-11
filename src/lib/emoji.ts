/* Unicode emojis: generated data (pt/en) lazy-loaded + search. */

export interface EmojiItem {
  /** Emoji character. */
  c: string;
  /** Localized label. */
  l: string;
  /** Localized search tags. */
  t?: string[];
  /** Skin-tone variants, from light to dark. */
  s?: string[];
}

export interface EmojiGroup {
  id: number;
  label: string;
  emojis: EmojiItem[];
}

/** Loads the language dataset as a separate chunk. */
export async function loadEmojiGroups(language: string): Promise<EmojiGroup[]> {
  if (language === "en") {
    return (await import("./emoji-data.en")).EMOJI_GROUPS;
  }
  return (await import("./emoji-data.pt")).EMOJI_GROUPS;
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Flat search by character, label and tags; returns at most `limit` items. */
export function searchEmojis(groups: EmojiGroup[], query: string, limit = 160): EmojiItem[] {
  const raw = query.trim();
  const needle = normalize(raw);
  if (!needle) return [];
  const results: EmojiItem[] = [];
  for (const group of groups) {
    for (const item of group.emojis) {
      const hit =
        item.c.includes(raw) ||
        normalize(item.l).includes(needle) ||
        item.t?.some((tag) => normalize(tag).includes(needle));
      if (!hit) continue;
      results.push(item);
      if (results.length >= limit) return results;
    }
  }
  return results;
}
