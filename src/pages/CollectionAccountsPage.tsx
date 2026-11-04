import type { JSX } from "preact";
import { useEffect, useState } from "preact/hooks";
import type { Account, CollectionWithAccounts } from "../api/types";
import { requestVoid } from "../api/client";
import { t } from "../i18n/pt-BR";
import {
  canAddToCollection,
  collectionAccountPolicy,
  collectionEntries,
  MAX_COLLECTION_ACCOUNTS,
} from "../lib/collections";
import { httpStatusOf, userMessageForError } from "../lib/errors";
import { clientFor, hrefFor, isOwnInstance, tokenFor } from "../lib/identity";
import { back, navigate } from "../lib/router";
import { currentAccount, toast } from "../state/store";
import { useAppState } from "../state/hooks";
import { useCollectionAccountSearch } from "../components/collections/useCollectionAccountSearch";
import { useCollectionsSupport } from "../components/collections/useCollectionsSupport";
import { Avatar } from "../components/ui/Avatar";
import { EmojiText } from "../components/status/EmojiText";
import { Icon } from "../components/ui/Icon";
import { PageShell } from "../components/ui/PageShell";
import "../components/collections/collections.css";

interface Props {
  params: { instance?: string; id: string };
}

type ManageStatus = "loading" | "ready" | "unsupported" | "forbidden" | "error";

function Notice({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string;
  onRetry?: () => void;
}): JSX.Element {
  return (
    <div class="center-state">
      <Icon name="group-line" size={28} />
      <h3>{title}</h3>
      <p>{message}</p>
      <div class="btn-row">
        <button type="button" class="btn ghost" onClick={() => back()}>
          <Icon name="back-line" size={16} />
          {t.back}
        </button>
        {onRetry && (
          <button type="button" class="btn ghost" onClick={onRetry}>
            <Icon name="refresh-2-line" size={16} />
            {t.retry}
          </button>
        )}
      </div>
    </div>
  );
}

export function CollectionAccountsPage({ params }: Props): JSX.Element {
  const appState = useAppState();
  const viewer = currentAccount();
  const instance = params.instance ?? viewer?.instance ?? "";
  const supported = useCollectionsSupport(instance);
  const [data, setData] = useState<CollectionWithAccounts | null>(null);
  const [status, setStatus] = useState<ManageStatus>("loading");
  const [loadError, setLoadError] = useState<unknown>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (supported === null) {
      setStatus("loading");
      return;
    }
    if (!supported) {
      setStatus("unsupported");
      return;
    }
    const me = appState.me;
    if (!me || !viewer || !instance || !isOwnInstance(instance)) {
      setStatus("forbidden");
      return;
    }

    setStatus("loading");
    setLoadError(null);
    void (async () => {
      try {
        const response = await clientFor(instance).client.v1.collections.$select(params.id).fetch();
        if (cancelled) return;
        if (!response.collection.local || response.collection.accountId !== me.id) {
          setStatus("forbidden");
          return;
        }
        setData(response);
        setStatus("ready");
      } catch (err) {
        console.warn("[oltn] collection accounts load failed", err);
        if (cancelled) return;
        setLoadError(err);
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [appState.me?.id, instance, params.id, revision, supported, viewer]);

  const entries = data ? collectionEntries(data) : [];
  const excludedIds = entries.map((entry) => entry.account.id);
  const search = useCollectionAccountSearch(instance, query, excludedIds);
  const maxReached = entries.length >= MAX_COLLECTION_ACCOUNTS;
  const busyAny = !!busy;

  const addAccount = async (candidate: Account): Promise<void> => {
    if (!data || busy || maxReached || !canAddToCollection(candidate)) return;
    setBusy(candidate.id);
    try {
      await clientFor(instance)
        .client.v1.collections.$select(data.collection.id)
        .items.create({ accountId: candidate.id });
      setQuery("");
      toast(t.collectionMemberAdded, "ok");
      setRevision((n) => n + 1);
    } catch (err) {
      console.warn("[oltn] collection account add failed", err);
      toast(userMessageForError(err, t.collectionMemberAddError), "error");
    } finally {
      setBusy(null);
    }
  };

  const removeAccount = async (account: Account, itemId: string): Promise<void> => {
    if (!data || busy) return;
    if (!window.confirm(t.collectionRemoveConfirm)) return;
    setBusy(account.id);
    try {
      const token = tokenFor(instance);
      if (!token) throw new Error("missing_token");
      await requestVoid(
        instance,
        token,
        `/api/v1/collections/${encodeURIComponent(data.collection.id)}/items/${encodeURIComponent(
          itemId,
        )}`,
        "DELETE",
      );
      toast(t.collectionMemberRemoved, "ok");
      setRevision((n) => n + 1);
    } catch (err) {
      console.warn("[oltn] collection account remove failed", err);
      toast(userMessageForError(err, t.collectionMemberRemoveError), "error");
    } finally {
      setBusy(null);
    }
  };

  const title = t.collectionManageAccounts;
  if (status === "loading") {
    return (
      <PageShell title={title} showBack>
        <div class="center-state">
          <span class="spinner" />
        </div>
      </PageShell>
    );
  }

  if (status !== "ready" || !data) {
    const notice =
      status === "unsupported"
        ? { title: t.collectionsUnavailable, message: t.collectionFormUnavailable }
        : status === "forbidden"
          ? { title: t.collectionEditForbidden, message: t.collectionEditForbiddenHint }
          : {
              title: httpStatusOf(loadError) === 404 ? t.collectionNotFound : t.collectionLoadError,
              message: userMessageForError(loadError, t.collectionLoadError),
            };
    return (
      <PageShell title={title} showBack>
        <Notice
          title={notice.title}
          message={notice.message}
          onRetry={status === "error" ? () => setRevision((n) => n + 1) : undefined}
        />
      </PageShell>
    );
  }

  return (
    <PageShell
      title={title}
      subtitle={data.collection.name}
      showBack
      actions={
        <button
          type="button"
          class="icon-btn"
          title={t.editCollection}
          aria-label={t.editCollection}
          onClick={() => navigate(`${hrefFor.collection(data.collection.id, instance)}/edit`)}
        >
          <Icon name="pencil-line" size={18} />
        </button>
      }
    >
      <div class="collection-manage">
        <div class="collection-manage-head">
          <h2>{t.collectionFeaturedAccounts}</h2>
          <span class="muted">
            {entries.length}/{MAX_COLLECTION_ACCOUNTS} {t.accounts}
          </span>
        </div>

        <div class="collection-search">
          <input
            class="field"
            placeholder={t.collectionSearchPlaceholder}
            aria-label={t.collectionSearchPlaceholder}
            value={query}
            disabled={maxReached || busyAny}
            autocomplete="off"
            autocapitalize="off"
            spellcheck={false}
            onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
          />
          <p class="collection-editor-hint">
            {maxReached ? t.collectionAtLimit : t.collectionSearchHint}
          </p>
          {query.trim() && !maxReached && (
            <div
              class="collection-search-results"
              role="listbox"
              aria-label={t.collectionSearchPlaceholder}
            >
              {search.loading ? (
                <div class="collection-search-loading">
                  <span class="spinner" />
                </div>
              ) : (
                search.accounts.map((candidate) => {
                  const policy = collectionAccountPolicy(candidate);
                  const disabled = !canAddToCollection(candidate) || busyAny;
                  return (
                    <button
                      key={candidate.id}
                      type="button"
                      role="option"
                      class="collection-search-result"
                      disabled={disabled}
                      onClick={() => void addAccount(candidate)}
                    >
                      <Avatar
                        src={candidate.avatar}
                        name={candidate.displayName || candidate.username}
                        size={32}
                      />
                      <span class="row-main">
                        <span class="row-title">
                          <EmojiText
                            text={candidate.displayName || candidate.username}
                            emojis={candidate.emojis}
                          />
                        </span>
                        <span class="row-sub">@{candidate.acct}</span>
                      </span>
                      <span class={`collection-policy ${policy}`}>
                        {busy === candidate.id ? (
                          <span class="spinner" />
                        ) : policy === "denied" || policy === "unknown" ? (
                          t.collectionCannotAdd
                        ) : (
                          <>
                            <Icon name="plus-line" size={16} />
                            {policy === "manual"
                              ? t.collectionNeedsApproval
                              : t.collectionAddAccount}
                          </>
                        )}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        {entries.length ? (
          <div class="collection-accounts">
            {entries.map(({ item, account }) => (
              <div class="collection-account" key={item.id}>
                <button
                  type="button"
                  class="collection-account-main"
                  onClick={() => navigate(hrefFor.accountById(instance, account.id))}
                >
                  <Avatar
                    src={account.avatar}
                    name={account.displayName || account.username}
                    size={40}
                  />
                  <span class="row-main">
                    <span class="row-title">
                      <EmojiText
                        text={account.displayName || account.username}
                        emojis={account.emojis}
                      />
                      {item.state === "pending" && (
                        <span class="collection-pending-badge">{t.collectionPending}</span>
                      )}
                    </span>
                    <span class="row-sub">@{account.acct}</span>
                  </span>
                </button>
                <button
                  type="button"
                  class="icon-btn danger"
                  title={t.collectionRemoveAccount}
                  aria-label={t.collectionRemoveAccount}
                  disabled={busy === account.id}
                  onClick={() => void removeAccount(account, item.id)}
                >
                  {busy === account.id ? (
                    <span class="spinner" />
                  ) : (
                    <Icon name="close-line" size={16} />
                  )}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div class="center-state collection-empty-accounts">
            <Icon name="group-line" size={24} />
            <h3>{t.collectionNoAccounts}</h3>
          </div>
        )}
      </div>
    </PageShell>
  );
}
