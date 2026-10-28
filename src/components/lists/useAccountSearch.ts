import { useEffect, useRef, useState } from "preact/hooks";
import type { Account } from "../../api/types";
import { clientFor } from "../../lib/identity";

/** Debounced account search for the list member picker. */
export function useAccountSearch(
  instance: string,
  query: string,
  excludedIds: readonly string[],
): Account[] {
  const [items, setItems] = useState<Account[]>([]);
  const seq = useRef(0);
  const excludedKey = excludedIds.join(",");

  useEffect(() => {
    const q = query.trim().replace(/^@/, "");
    if (!instance || !q) {
      setItems([]);
      return;
    }
    const seqNow = ++seq.current;
    const timer = window.setTimeout(() => {
      void (async () => {
        const { client } = clientFor(instance);
        try {
          const result = await client.v2.search.list({
            q,
            resolve: false,
            type: "accounts",
            limit: 8,
          });
          if (seqNow !== seq.current) return;
          const excluded = new Set(excludedKey ? excludedKey.split(",") : []);
          setItems(result.accounts.filter((candidate) => !excluded.has(candidate.id)).slice(0, 6));
        } catch (err) {
          console.warn("[oltn] list account search failed", err);
        }
      })();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [instance, query, excludedKey]);

  return items;
}
