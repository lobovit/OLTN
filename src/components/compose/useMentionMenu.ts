import type { RefObject } from "preact";
import type { Dispatch, StateUpdater } from "preact/hooks";
import { useEffect, useRef, useState } from "preact/hooks";
import { getRest } from "../../api/client";
import type { Account, AccountMeta } from "../../api/types";

const MENTION_QUERY_RE = /(^|[\s\u00a0(])@(\w+)$/;
const MENTION_APPLY_RE = /@(\w*)$/;

function mentionInsertion(
  text: string,
  cursor: number,
  acct: string,
): { next: string; pos: number } | null {
  const match = MENTION_APPLY_RE.exec(text.slice(0, cursor));
  if (!match) return null;
  const start = cursor - match[0].length;
  const insert = `@${acct}`;
  return { next: text.slice(0, start) + insert + text.slice(cursor), pos: start + insert.length };
}

/** Searches accounts for the `@partial` typed in the composer. */
function useMentionSearch(
  instance: string,
  account: AccountMeta | null,
  query: string | null,
): Account[] {
  const [items, setItems] = useState<Account[]>([]);
  const seq = useRef(0);

  useEffect(() => {
    if (query == null || query.length < 1 || !account) {
      setItems([]);
      return;
    }
    const seqNow = ++seq.current;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const client = getRest(instance, account.accessToken);
          const result = await client.v2.search.list({
            q: query,
            type: "accounts",
            resolve: false,
            limit: 5,
          });
          if (seqNow !== seq.current) return;
          setItems(result.accounts.slice(0, 5));
        } catch (err) {
          console.warn("[oltn] mention search failed", err);
        }
      })();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, instance, account]);

  return items;
}

type MentionKey = "next" | "prev" | "pick";

function mentionKeyFor(e: KeyboardEvent, open: boolean): MentionKey | null {
  if (!open) return null;
  // Shift+Enter/Tab are normal editing keys even with suggestions open.
  if (e.shiftKey) return null;
  if (e.key === "ArrowDown") return "next";
  if (e.key === "ArrowUp") return "prev";
  if (e.key === "Enter" || e.key === "Tab") return "pick";
  return null;
}

export interface MentionMenuState {
  items: Account[];
  index: number;
  setIndex: Dispatch<StateUpdater<number>>;
  /** Re-reads the `@partial` under the caret. */
  sync: (target: HTMLTextAreaElement) => void;
  /** Replaces the `@partial` with the picked account. */
  pick: (picked: Account) => void;
  /** Clears the suggestions (e.g. on blur). */
  clear: () => void;
  /** Handles menu navigation keys; returns true when consumed. */
  handleKey: (e: KeyboardEvent) => boolean;
}

/** Mention autocomplete for the composer textarea. */
export function useMentionMenu(input: {
  instance: string;
  account: AccountMeta | null;
  text: string;
  setText: Dispatch<StateUpdater<string>>;
  textRef: RefObject<HTMLTextAreaElement | null>;
}): MentionMenuState {
  const { instance, account, text, setText, textRef } = input;
  const [query, setQuery] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [dismissedStart, setDismissedStart] = useState<number | null>(null);
  const items = useMentionSearch(instance, account, query);

  useEffect(() => {
    setIndex(0);
  }, [items]);

  const sync = (target: HTMLTextAreaElement): void => {
    const cursor = target.selectionStart ?? target.value.length;
    const match = MENTION_QUERY_RE.exec(target.value.slice(0, cursor));
    if (!match) {
      setQuery(null);
      setDismissedStart(null);
      return;
    }
    const start = cursor - match[2].length - 1;
    // After Escape, keep this same mention dismissed until a new @ is typed.
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
    const match = MENTION_QUERY_RE.exec(ta.value.slice(0, cursor));
    setDismissedStart(match ? cursor - match[2].length - 1 : null);
    setQuery(null);
  };

  const pick = (picked: Account): void => {
    const ta = textRef.current;
    const insertion = ta
      ? mentionInsertion(text, ta.selectionStart ?? text.length, picked.acct)
      : null;
    setQuery(null);
    setDismissedStart(null);
    if (!ta || !insertion) return;
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
    const action = mentionKeyFor(e, items.length > 0);
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
