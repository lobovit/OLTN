import type { JSX } from "preact";
import { useEffect, useMemo, useState } from "preact/hooks";
import type { Account, CollectionWithAccounts } from "../api/types";
import { t } from "../i18n/pt-BR";
import { requestVoid } from "../api/client";
import {
  collectionAccountHandle,
  collectionEntries,
  collectionOwner,
  collectionPreviewAccountIds,
  collectionShareLink,
} from "../lib/collections";
import { httpStatusOf, userMessageForError } from "../lib/errors";
import { timeAgo } from "../lib/format";
import { clientFor, hrefFor, isOwnInstance, tokenFor } from "../lib/identity";
import { back, navigate } from "../lib/router";
import { currentAccount, toast } from "../state/store";
import {
  useCollectionRelationships,
  type CollectionRelationshipState,
} from "../components/collections/useCollectionRelationships";
import { collectionAccountCount } from "../components/collections/format";
import { Avatar } from "../components/ui/Avatar";
import { Content } from "../components/status/Content";
import { EmojiText } from "../components/status/EmojiText";
import { Icon } from "../components/ui/Icon";
import { PageShell } from "../components/ui/PageShell";
import { Sheet } from "../components/ui/Sheet";
import { CollectionReportSheet } from "../components/collections/CollectionReportSheet";
import { plainTextToHtml } from "../lib/format";
import "../components/collections/collections.css";

interface Props {
  params: { instance?: string; id: string };
}

function normalizedHandle(handle: string): string {
  return handle.trim().replace(/^@+/, "").toLowerCase();
}

function isCurrentUser(account: Account, sourceInstance: string): boolean {
  const me = currentAccount();
  if (!me) return false;
  return (
    normalizedHandle(collectionAccountHandle(account, sourceInstance)) ===
    normalizedHandle(me.handle)
  );
}

function CollectionAccountRow({
  account,
  instance,
  pending,
  current,
  state,
  canFollow,
  onFollow,
}: {
  account: Account;
  instance: string;
  pending: boolean;
  current: boolean;
  state?: CollectionRelationshipState;
  canFollow: boolean;
  onFollow: (accountId: string) => Promise<void>;
}): JSX.Element {
  const relationship = state?.relationship;
  const following = relationship?.following || relationship?.requested;
  return (
    <div class="collection-account">
      <button
        type="button"
        class="collection-account-main"
        onClick={() => navigate(hrefFor.accountById(instance, account.id))}
      >
        <Avatar src={account.avatar} name={account.displayName || account.username} size={40} />
        <span class="row-main">
          <span class="row-title">
            <EmojiText text={account.displayName || account.username} emojis={account.emojis} />
            {pending && <span class="collection-pending-badge">{t.collectionPending}</span>}
            {current && <span class="collection-you-badge">{t.collectionYou}</span>}
          </span>
          <span class="row-sub">@{collectionAccountHandle(account, instance)}</span>
        </span>
      </button>
      {canFollow && !current && (
        <button
          type="button"
          class={`btn sm ${following ? "ghost" : "primary"}`}
          disabled={!state?.localId || state.busy}
          onClick={() => void onFollow(account.id)}
        >
          {state?.busy ? (
            <span class="spinner" />
          ) : following ? (
            relationship?.requested ? (
              t.followRequested
            ) : (
              t.unfollow
            )
          ) : (
            t.follow
          )}
        </button>
      )}
    </div>
  );
}

function AccountAvatarGrid({
  ids,
  accounts,
  sensitive,
}: {
  ids: readonly string[];
  accounts: ReadonlyMap<string, Account>;
  sensitive: boolean;
}): JSX.Element {
  return (
    <span class={`collection-detail-avatars ${sensitive ? "is-sensitive" : ""}`}>
      {ids.map((id, index) => {
        const account = accounts.get(id);
        return (
          <Avatar
            key={`${id}-${index}`}
            src={account?.avatar}
            name={account?.displayName || account?.username || "?"}
            size={44}
          />
        );
      })}
      {sensitive && (
        <span class="collection-sensitive-badge" title={t.collectionSensitive}>
          <Icon name="eye-close-line" size={14} />
        </span>
      )}
    </span>
  );
}

export function CollectionPage({ params }: Props): JSX.Element {
  const instance = params.instance ?? currentAccount()?.instance ?? "";
  const [data, setData] = useState<CollectionWithAccounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [revealed, setRevealed] = useState(false);
  const [revision, setRevision] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [blocking, setBlocking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!instance || !params.id) {
      setLoading(false);
      setError(new Error("missing_collection"));
      return;
    }
    setLoading(true);
    setError(null);
    setRevealed(false);
    void (async () => {
      try {
        const collection = await clientFor(instance)
          .client.v1.collections.$select(params.id)
          .fetch();
        if (!cancelled) setData(collection);
      } catch (err) {
        console.warn("[oltn] collection load failed", err);
        if (!cancelled) setError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [instance, params.id, revision]);

  const entries = useMemo(() => (data ? collectionEntries(data) : []), [data]);
  const { states, toggle } = useCollectionRelationships(
    entries.map((entry) => entry.account),
    instance,
  );
  const owner = data ? collectionOwner(data) : null;

  const copyLink = async (): Promise<void> => {
    if (!data) return;
    const fallback = `${location.origin}${location.pathname}#${hrefFor.collection(
      data.collection.id,
      instance,
    )}`;
    try {
      await navigator.clipboard.writeText(collectionShareLink(data.collection, fallback));
      toast(t.linkCopied, "ok");
    } catch (err) {
      console.warn("[oltn] collection share failed", err);
      toast(t.errorGeneric, "error");
    }
  };

  if (loading) {
    return (
      <PageShell title={t.collection} showBack>
        <div class="center-state">
          <span class="spinner" />
        </div>
      </PageShell>
    );
  }

  if (error || !data) {
    const notFound = httpStatusOf(error) === 404;
    return (
      <PageShell title={t.collection} showBack>
        <div class="center-state">
          <Icon name="list-check-line" size={28} />
          <h3>{notFound ? t.collectionNotFound : t.collectionLoadError}</h3>
          {!notFound && error && <p>{userMessageForError(error, t.collectionLoadError)}</p>}
          <div class="btn-row">
            <button type="button" class="btn ghost" onClick={() => back()}>
              <Icon name="back-line" size={16} />
              {t.back}
            </button>
            <button type="button" class="btn ghost" onClick={() => setRevision((n) => n + 1)}>
              <Icon name="refresh-2-line" size={16} />
              {t.retry}
            </button>
          </div>
        </div>
      </PageShell>
    );
  }

  const collection = data.collection;
  const accounts = new Map(data.accounts.map((account) => [account.id, account]));
  const previewIds = collectionPreviewAccountIds(collection, 4);
  const showContent = !collection.sensitive || revealed;
  const current = currentAccount();
  const canFollow = !!current;
  const description = collection.local
    ? plainTextToHtml(collection.description || "")
    : collection.description || "";
  const ownerHandle = owner ? collectionAccountHandle(owner, instance) : "";
  const canEdit = !!current && collection.local && collection.accountId === current.id;
  const currentEntry = entries.find(({ account }) => isCurrentUser(account, instance));
  const canRevoke = !!currentEntry && !!current && isOwnInstance(instance);
  const showInteractions = !!owner && !!current && !canEdit && isOwnInstance(instance);
  const blockOwner = async (): Promise<void> => {
    if (!owner || blocking || !window.confirm(t.collectionBlockConfirm)) return;
    setMoreOpen(false);
    setBlocking(true);
    try {
      await clientFor(instance).client.v1.accounts.$select(owner.id).block();
      toast(t.blocked, "ok");
      navigate("/collections", { replace: true });
    } catch (err) {
      console.warn("[oltn] collection block failed", err);
      toast(userMessageForError(err, t.errorGeneric), "error");
    } finally {
      setBlocking(false);
    }
  };

  const deleteCollection = async (): Promise<void> => {
    if (!canEdit || deleting || !window.confirm(t.collectionDeleteConfirm)) return;
    setDeleting(true);
    try {
      const token = tokenFor(instance);
      if (!token) throw new Error("missing_token");
      await requestVoid(
        instance,
        token,
        `/api/v1/collections/${encodeURIComponent(collection.id)}`,
        "DELETE",
      );
      toast(t.collectionDeleted, "ok");
      navigate("/collections", { replace: true });
    } catch (err) {
      console.warn("[oltn] collection delete failed", err);
      toast(userMessageForError(err, t.collectionDeleteError), "error");
    } finally {
      setDeleting(false);
    }
  };
  const revokeInclusion = async (): Promise<void> => {
    if (!currentEntry || revoking || !window.confirm(t.collectionRevokeConfirm)) return;
    setRevoking(true);
    try {
      const token = tokenFor(instance);
      if (!token) throw new Error("missing_token");
      await requestVoid(
        instance,
        token,
        `/api/v1/collections/${encodeURIComponent(collection.id)}/items/${encodeURIComponent(
          currentEntry.item.id,
        )}/revoke`,
        "POST",
      );
      toast(t.collectionRevoked, "ok");
      setRevision((n) => n + 1);
    } catch (err) {
      console.warn("[oltn] collection revoke failed", err);
      toast(userMessageForError(err, t.collectionRevokeError), "error");
    } finally {
      setRevoking(false);
    }
  };

  return (
    <PageShell
      title={collection.name}
      subtitle={ownerHandle ? `@${ownerHandle}` : undefined}
      showBack
      actions={
        <div class="collection-actions">
          {canEdit && (
            <button
              type="button"
              class="icon-btn"
              title={t.collectionManageAccounts}
              aria-label={t.collectionManageAccounts}
              onClick={() => navigate(`${hrefFor.collection(collection.id, instance)}/accounts`)}
            >
              <Icon name="group-line" size={18} />
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              class="icon-btn"
              title={t.editCollection}
              aria-label={t.editCollection}
              onClick={() => navigate(`${hrefFor.collection(collection.id, instance)}/edit`)}
            >
              <Icon name="pencil-line" size={18} />
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              class="icon-btn danger"
              title={t.collectionDelete}
              aria-label={t.collectionDelete}
              disabled={deleting}
              onClick={() => void deleteCollection()}
            >
              {deleting ? <span class="spinner" /> : <Icon name="delete-line" size={18} />}
            </button>
          )}
          {showInteractions && (
            <button
              type="button"
              class="icon-btn"
              title={t.moreOptions}
              aria-label={t.moreOptions}
              onClick={() => setMoreOpen(true)}
            >
              <Icon name="more-1-line" size={18} />
            </button>
          )}
          <button
            type="button"
            class="icon-btn"
            title={t.collectionCopyLink}
            aria-label={t.collectionCopyLink}
            onClick={() => void copyLink()}
          >
            <Icon name="link-line" size={18} />
          </button>
        </div>
      }
    >
      <article class="collection-detail">
        <header class="collection-detail-head">
          <AccountAvatarGrid
            ids={previewIds}
            accounts={accounts}
            sensitive={collection.sensitive}
          />
          <div class="collection-detail-copy">
            <h2>{collection.name}</h2>
            {owner && (
              <div class="collection-byline">
                {t.collectionBy}{" "}
                <button
                  type="button"
                  class="collection-link"
                  onClick={() => navigate(hrefFor.accountById(instance, owner.id))}
                >
                  @{ownerHandle}
                </button>
              </div>
            )}
            <div class="collection-meta">
              <span>
                <Icon name="group-line" size={14} />
                {collectionAccountCount(collection.itemCount)}
              </span>
              {collection.tag && (
                <button
                  type="button"
                  class="collection-tag"
                  onClick={() => navigate(hrefFor.tag(collection.tag?.name ?? "", instance))}
                >
                  #{collection.tag.name}
                </button>
              )}
              <span>
                {collection.discoverable ? t.collectionDiscoverable : t.collectionUnlisted}
              </span>
              {collection.updatedAt && (
                <span>
                  {t.collectionUpdated} {timeAgo(collection.updatedAt)}
                </span>
              )}
            </div>
          </div>
        </header>

        {!showContent ? (
          <div class="collection-sensitive-panel">
            <Icon name="eye-close-line" size={24} />
            <h3>{t.collectionSensitive}</h3>
            <p>{t.collectionSensitiveHint}</p>
            <button type="button" class="btn primary" onClick={() => setRevealed(true)}>
              {t.collectionShow}
            </button>
          </div>
        ) : (
          <>
            {canRevoke && (
              <div class="collection-membership">
                <div>
                  <strong>{t.collectionYouAreFeatured}</strong>
                  <span>{t.collectionYouAreFeaturedHint}</span>
                </div>
                <button
                  type="button"
                  class="btn ghost sm"
                  disabled={revoking}
                  onClick={() => void revokeInclusion()}
                >
                  {revoking ? <span class="spinner" /> : t.collectionRevoke}
                </button>
              </div>
            )}
            {description && <Content html={description} class="collection-description" />}
            <h3 class="collection-accounts-title">{t.collectionFeaturedAccounts}</h3>
            {entries.length ? (
              <div class="collection-accounts">
                {entries.map(({ item, account }) => (
                  <CollectionAccountRow
                    key={item.id}
                    account={account}
                    instance={instance}
                    pending={item.state === "pending"}
                    current={isCurrentUser(account, instance)}
                    state={states[account.id]}
                    canFollow={canFollow}
                    onFollow={toggle}
                  />
                ))}
              </div>
            ) : (
              <div class="center-state collection-empty-accounts">
                <Icon name="group-line" size={24} />
                <h3>{t.collectionNoAccounts}</h3>
              </div>
            )}
          </>
        )}
      </article>

      {moreOpen && (
        <Sheet title={t.more} onClose={() => setMoreOpen(false)} class="mobile-menu">
          <button
            type="button"
            class="menu-row"
            onClick={() => {
              setMoreOpen(false);
              setReportOpen(true);
            }}
          >
            <Icon name="report-line" size={18} />
            <span>{t.collectionReport}</span>
          </button>
          <button
            type="button"
            class="menu-row danger"
            disabled={blocking}
            onClick={() => void blockOwner()}
          >
            <Icon name="user-forbid-line" size={18} />
            <span>{t.collectionBlockOwner}</span>
          </button>
        </Sheet>
      )}

      {reportOpen && owner && (
        <CollectionReportSheet
          collection={collection}
          owner={owner}
          instance={instance}
          onClose={() => setReportOpen(false)}
        />
      )}
    </PageShell>
  );
}
