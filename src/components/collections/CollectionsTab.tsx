import type { JSX } from "preact";
import { useEffect, useState } from "preact/hooks";
import type { Account, Collection, RestClient } from "../../api/types";
import { t } from "../../i18n/pt-BR";
import { httpStatusOf, userMessageForError } from "../../lib/errors";
import { canCreateCollection, collectionPreviewAccountIds } from "../../lib/collections";
import { clientFor } from "../../lib/identity";
import { navigate } from "../../lib/router";
import { useAppState } from "../../state/hooks";
import { CollectionCard } from "./CollectionCard";
import { Icon } from "../ui/Icon";
import "./collections.css";

interface CollectionsTabProps {
  account: Pick<Account, "id">;
  instance: string;
  isSelf: boolean;
}

const ACCOUNT_BATCH = 40;

async function fetchAccountsByIds(
  client: RestClient,
  ids: readonly string[],
): Promise<Map<string, Account>> {
  const accounts = new Map<string, Account>();
  const unique = [...new Set(ids.filter(Boolean))];
  for (let index = 0; index < unique.length; index += ACCOUNT_BATCH) {
    const page = await client.v1.accounts.fetch({
      id: unique.slice(index, index + ACCOUNT_BATCH),
    });
    for (const account of page) accounts.set(account.id, account);
  }
  return accounts;
}

function previewIds(collections: readonly Collection[]): string[] {
  return collections.flatMap((collection) => [
    collection.accountId,
    ...collectionPreviewAccountIds(collection, 4),
  ]);
}

function CollectionList({
  collections,
  instance,
  accounts,
  empty,
}: {
  collections: readonly Collection[];
  instance: string;
  accounts: ReadonlyMap<string, Account>;
  empty: string;
}): JSX.Element {
  if (!collections.length) {
    return (
      <div class="collection-empty">
        <Icon name="list-check-line" size={22} />
        <span>{empty}</span>
      </div>
    );
  }
  return (
    <div class="collection-list">
      {collections.map((collection) => (
        <CollectionCard
          key={collection.id}
          collection={collection}
          instance={instance}
          accounts={accounts}
        />
      ))}
    </div>
  );
}

/** Read-only Collections tab for a profile. */
export function CollectionsTab({ account, instance, isSelf }: CollectionsTabProps): JSX.Element {
  const [created, setCreated] = useState<Collection[]>([]);
  const [featuring, setFeaturing] = useState<Collection[]>([]);
  const [accounts, setAccounts] = useState<Map<string, Account>>(new Map());
  const [loading, setLoading] = useState(true);
  const [unsupported, setUnsupported] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [revision, setRevision] = useState(0);
  const appState = useAppState();
  const limit = appState.me?.role?.collectionLimit ?? 0;
  const canCreate = isSelf && canCreateCollection(limit, created.length);

  useEffect(() => {
    let cancelled = false;
    const client = clientFor(instance).client;
    setLoading(true);
    setError(null);
    setUnsupported(false);
    setAccounts(new Map());
    void (async () => {
      try {
        const selected = client.v1.accounts.$select(account.id);
        const createdPage = await selected.collections.list({ limit: 40 });
        if (cancelled) return;
        setCreated(createdPage.collections);

        let featuringPage: Collection[] = [];
        if (isSelf) {
          try {
            const inCollections = await selected.inCollections.list({ limit: 40 });
            featuringPage = inCollections.collections;
          } catch (err) {
            console.warn("[oltn] featuring collections failed", err);
          }
        }
        if (cancelled) return;
        setFeaturing(featuringPage);

        try {
          const map = await fetchAccountsByIds(
            client,
            previewIds([...createdPage.collections, ...featuringPage]),
          );
          if (!cancelled) setAccounts(map);
        } catch (err) {
          console.warn("[oltn] collection account previews failed", err);
          if (!cancelled) setAccounts(new Map());
        }
      } catch (err) {
        console.warn("[oltn] collections load failed", err);
        if (cancelled) return;
        if (httpStatusOf(err) === 404) setUnsupported(true);
        else setError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [account.id, instance, isSelf, revision]);

  if (loading) {
    return (
      <div class="center-state">
        <span class="spinner" />
      </div>
    );
  }

  if (unsupported) {
    return (
      <div class="center-state">
        <Icon name="list-check-line" size={28} />
        <h3>{t.collectionsUnavailable}</h3>
      </div>
    );
  }

  if (error) {
    return (
      <div class="center-state">
        <Icon name="wifi-off-line" size={28} />
        <h3>{userMessageForError(error, t.collectionLoadError)}</h3>
        <button type="button" class="btn ghost" onClick={() => setRevision((n) => n + 1)}>
          <Icon name="refresh-2-line" size={16} />
          {t.retry}
        </button>
      </div>
    );
  }

  return (
    <div class="collections-tab">
      <section class="collection-section">
        <div class="collection-section-head">
          <h2 class="collection-section-title">
            {isSelf ? t.collectionsCreatedByYou : t.collections}
          </h2>
          {canCreate && (
            <button type="button" class="btn ghost sm" onClick={() => navigate("/collections/new")}>
              <Icon name="plus-line" size={14} />
              {t.newCollection}
            </button>
          )}
        </div>
        <CollectionList
          collections={created}
          instance={instance}
          accounts={accounts}
          empty={isSelf ? t.collectionEmptyCreatedSelf : t.collectionEmptyCreatedOther}
        />
      </section>

      {isSelf && (
        <section class="collection-section">
          <h2 class="collection-section-title">{t.collectionsFeaturingYou}</h2>
          <CollectionList
            collections={featuring}
            instance={instance}
            accounts={accounts}
            empty={t.collectionEmptyFeaturing}
          />
        </section>
      )}
    </div>
  );
}
