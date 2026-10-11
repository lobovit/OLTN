/* Emojis Unicode: dados gerados (pt/en) carregados sob demanda + busca. */

export interface EmojiItem {
  /** Caractere do emoji. */
  c: string;
  /** Rótulo localizado. */
  l: string;
  /** Tags de busca localizadas. */
  t?: string[];
  /** Variantes de tom de pele, da clara à escura. */
  s?: string[];
}

export interface EmojiGroup {
  id: number;
  label: string;
  emojis: EmojiItem[];
}

/** Carrega o dataset do idioma como chunk separado. */
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

/** Busca plana por caractere, rótulo e tags; devolve no máximo `limit` itens. */
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
