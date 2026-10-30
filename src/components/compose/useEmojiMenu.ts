import type { RefObject } from "preact";
import type { Dispatch, StateUpdater } from "preact/hooks";
import { useEffect, useMemo, useState } from "preact/hooks";
import { getCustomEmojis } from "../../api/client";
import type { AccountMeta, CustomEmoji } from "../../api/types";
import { loadEmojiGroups, searchEmojis, type EmojiGroup, type EmojiItem } from "../../lib/emoji";
import { normalizeEmojiUrl } from "../../lib/sanitize";
import { store } from "../../state/store";

const EMOJI_QUERY_RE = /(^|[\s\u00a0(]):([\w+-]{1,})$/;
const EMOJI_APPLY_RE = /:([\w+-]*)$/;

export type EmojiSuggestion =
  | { kind: "custom"; emoji: CustomEmoji }
  | { kind: "unicode"; emoji: EmojiItem };

function emojiInsertion(
  text: string,
  cursor: number,
  snippet: string,
): { next: string; pos: number } | null {
  const match = EMOJI_APPLY_RE.exec(text.slice(0, cursor));
  if (!match) return null;
  const start = cursor - match[0].length;
  return { next: text.slice(0, start) + snippet + text.slice(cursor), pos: start + snippet.length };
}

type EmojiKey = "next" | "prev" | "pick";

function emojiKeyFor(e: KeyboardEvent, open: boolean): EmojiKey | null {
  if (!open) return null;
  if (e.shiftKey) return null;
  if (e.key === "ArrowDown") return "next";
  if (e.key === "ArrowUp") return "prev";
  if (e.key === "Enter" || e.key === "Tab") return "pick";
  return null;
}

export interface EmojiMenuState {
  items: EmojiSuggestion[];
  index: number;
  setIndex: Dispatch<StateUpdater<number>>;
  sync: (target: HTMLTextAreaElement) => void;
  pick: (suggestion: EmojiSuggestion) => void;
  clear: () => void;
  handleKey: (e: KeyboardEvent) => boolean;
}

/** Inline `:shortcode` autocomplete for custom and Unicode emojis. */
export function useEmojiMenu(input: {
  instance: string;
  account: AccountMeta | null;
  text: string;
  setText: Dispatch<StateUpdater<string>>;
  textRef: RefObject<HTMLTextAreaElement | null>;
}): EmojiMenuState {
  const { instance, account, text, setText, textRef } = input;
  const [query, setQuery] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [dismissedStart, setDismissedStart] = useState<number | null>(null);
  const [custom, setCustom] = useState<CustomEmoji[] | null>(null);
  const [groups, setGroups] = useState<EmojiGroup[] | null>(null);
  const active = query !== null;

  useEffect(() => {
    if (!active || !account || custom) return;
    let cancelled = false;
    void getCustomEmojis(instance, account.accessToken)
      .then((list) => {
        if (!cancelled) setCustom(list);
      })
      .catch((err) => {
        console.warn("[oltn] custom emoji autocomplete failed", err);
        if (!cancelled) setCustom([]);
      });
    return () => {
      cancelled = true;
    };
  }, [active, account, custom, instance]);

  useEffect(() => {
    if (!active || groups) return;
    let cancelled = false;
    void loadEmojiGroups(store.settings.language)
      .then((data) => {
        if (!cancelled) setGroups(data);
      })
      .catch((err) => {
        console.warn("[oltn] emoji autocomplete data failed", err);
        if (!cancelled) setGroups([]);
      });
    return () => {
      cancelled = true;
    };
  }, [active, groups]);

  const items = useMemo<EmojiSuggestion[]>(() => {
    if (query === null) return [];
    const needle = query.toLowerCase();
    const suggestions: EmojiSuggestion[] = [];
    for (const emoji of custom ?? []) {
      if (!emoji.shortcode.toLowerCase().includes(needle)) continue;
      if (!normalizeEmojiUrl(emoji.url)) continue;
      suggestions.push({ kind: "custom", emoji });
      if (suggestions.length >= 5) break;
    }
    if (groups && suggestions.length < 8) {
      for (const emoji of searchEmojis(groups, query, 5)) {
        suggestions.push({ kind: "unicode", emoji });
      }
    }
    return suggestions.slice(0, 8);
  }, [query, custom, groups]);

  useEffect(() => {
    setIndex(0);
  }, [items]);

  const sync = (target: HTMLTextAreaElement): void => {
    const cursor = target.selectionStart ?? target.value.length;
    const match = EMOJI_QUERY_RE.exec(target.value.slice(0, cursor));
    if (!match) {
      setQuery(null);
      setDismissedStart(null);
      return;
    }
    const start = cursor - match[2].length - 1;
    // After Escape, keep this same shortcode dismissed until a new : is typed.
    if (dismissedStart === start) {
      setQuery(null);
      return;
    }
    setDismissedStart(null);
    setQuery(match[2]);
  };

  const dismiss = (): void => {
    const ta = textRef.current;
    if (!ta) return;
    const cursor = ta.selectionStart ?? ta.value.length;
    const match = EMOJI_QUERY_RE.exec(ta.value.slice(0, cursor));
    setDismissedStart(match ? cursor - match[2].length - 1 : null);
    setQuery(null);
  };

  const pick = (suggestion: EmojiSuggestion): void => {
    const ta = textRef.current;
    if (!ta) return;
    const cursor = ta.selectionStart ?? text.length;
    const snippet =
      suggestion.kind === "custom" ? `:${suggestion.emoji.shortcode}: ` : suggestion.emoji.c;
    const insertion = emojiInsertion(text, cursor, snippet);
    setQuery(null);
    setDismissedStart(null);
    if (!insertion) return;
    setText(insertion.next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(insertion.pos, insertion.pos);
    });
  };

  const clear = (): void => {
    setQuery(null);
    setDismissedStart(null);
  };

  const handleKey = (e: KeyboardEvent): boolean => {
    if (e.key === "Escape" && query !== null) {
      e.preventDefault();
      e.stopPropagation();
      dismiss();
      return true;
    }
    const action = emojiKeyFor(e, items.length > 0);
    if (!action) return false;
    e.preventDefault();
    if (action === "next") {
      setIndex((i) => Math.min(i + 1, items.length - 1));
    } else if (action === "prev") {
      setIndex((i) => Math.max(i - 1, 0));
    } else {
      pick(items[index]);
    }
    return true;
  };

  return { items, index, setIndex, sync, pick, clear, handleKey };
}
