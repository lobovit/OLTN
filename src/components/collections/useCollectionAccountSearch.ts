import { useEffect, useRef, useState } from "preact/hooks";
import type { Account } from "../../api/types";
import { clientFor } from "../../lib/identity";

/** Debounced account search for the collection editor, with remote resolution. */
export function useCollectionAccountSearch(
  instance: string,
  query: string,
  excludedIds: readonly string[],
): { accounts: Account[]; loading: boolean } {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);
  const excludedKey = excludedIds.join(",");

  useEffect(() => {
    const q = query.trim();
    if (!instance || !q) {
      setAccounts([]);
      setLoading(false);
      return;
    }
    const seqNow = ++seq.current;
    setLoading(true);
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const result = await clientFor(instance).client.v2.search.list({
            q,
            resolve: true,
            type: "accounts",
            limit: 8,
          });
          if (seqNow !== seq.current) return;
          const excluded = new Set(excludedKey ? excludedKey.split(",") : []);
          setAccounts(result.accounts.filter((account) => !excluded.has(account.id)).slice(0, 8));
        } catch (err) {
          console.warn("[oltn] collection account search failed", err);
          if (seqNow === seq.current) setAccounts([]);
        } finally {
          if (seqNow === seq.current) setLoading(false);
        }
      })();
    }, 250);
    return () => {
      window.clearTimeout(timer);
      seq.current += 1;
      setLoading(false);
    };
  }, [instance, query, excludedKey]);

  return { accounts, loading };
}
