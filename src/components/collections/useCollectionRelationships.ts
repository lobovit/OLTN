import { useEffect, useRef, useState } from "preact/hooks";
import type { Account, Relationship } from "../../api/types";
import { t } from "../../i18n/pt-BR";
import { userMessageForError } from "../../lib/errors";
import { clientFor, localAccountId } from "../../lib/identity";
import { collectionAccountHandle } from "../../lib/collections";
import { currentAccount, toast } from "../../state/store";

export interface CollectionRelationshipState {
  localId: string | null;
  relationship: Relationship | null;
  busy: boolean;
}

/**
 * Resolves collection accounts on the viewer's instance and loads their
 * relationship in a single batch. Collection ids belong to the source server,
 * so remote collections need one lookup per account before following.
 */
export function useCollectionRelationships(
  accounts: readonly Account[],
  sourceInstance: string,
): {
  states: Record<string, CollectionRelationshipState>;
  toggle: (accountId: string) => Promise<void>;
} {
  const accountsRef = useRef(accounts);
  accountsRef.current = accounts;
  const [states, setStates] = useState<Record<string, CollectionRelationshipState>>({});
  const me = currentAccount();
  const accountKey = accounts.map((account) => account.id).join(",");

  useEffect(() => {
    let cancelled = false;
    const viewer = currentAccount();
    if (!viewer || !accountKey) {
      setStates({});
      return;
    }

    const own = clientFor(viewer.instance).client;
    void (async () => {
      try {
        const entries = await Promise.all(
          accountsRef.current.map(async (account) => {
            const localId = await localAccountId(
              own,
              viewer.instance,
              {
                id: account.id,
                acct: collectionAccountHandle(account, sourceInstance),
              },
              sourceInstance,
            );
            return [account.id, localId] as const;
          }),
        );
        if (cancelled) return;

        const localIds = entries
          .map(([, localId]) => localId)
          .filter((localId): localId is string => !!localId);
        let relationships: Relationship[] = [];
        if (localIds.length) {
          relationships = await own.v1.accounts.relationships.fetch({ id: localIds });
        }
        if (cancelled) return;

        const byLocalId = new Map(
          relationships.map((relationship) => [relationship.id, relationship]),
        );
        const next: Record<string, CollectionRelationshipState> = {};
        for (const [sourceId, localId] of entries) {
          next[sourceId] = {
            localId,
            relationship: localId ? (byLocalId.get(localId) ?? null) : null,
            busy: false,
          };
        }
        setStates(next);
      } catch (err) {
        console.warn("[oltn] collection relationships failed", err);
        if (cancelled) return;
        const next: Record<string, CollectionRelationshipState> = {};
        for (const account of accountsRef.current) {
          next[account.id] = { localId: null, relationship: null, busy: false };
        }
        setStates(next);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [accountKey, sourceInstance, me?.id, me?.instance]);

  const toggle = async (accountId: string): Promise<void> => {
    const viewer = currentAccount();
    const current = states[accountId];
    if (!viewer || !current?.localId || current.busy) return;

    setStates((prev) => ({
      ...prev,
      [accountId]: { ...current, busy: true },
    }));
    try {
      const selected = clientFor(viewer.instance).client.v1.accounts.$select(current.localId);
      const following = current.relationship?.following || current.relationship?.requested;
      const relationship = following ? await selected.unfollow() : await selected.follow();
      setStates((prev) => ({
        ...prev,
        [accountId]: { ...prev[accountId], relationship, busy: false },
      }));
    } catch (err) {
      console.warn("[oltn] collection follow failed", err);
      setStates((prev) => ({
        ...prev,
        [accountId]: { ...prev[accountId], busy: false },
      }));
      toast(userMessageForError(err, t.errorGeneric), "error");
    }
  };

  return { states, toggle };
}
