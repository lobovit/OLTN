import type { JSX } from "preact";
import { useCallback, useEffect, useState } from "preact/hooks";
import type { Account, Relationship, Status } from "../api/types";
import { t } from "../i18n/pt-BR";
import { clientFor, isOwnInstance, localAccountId, mentionHandleFor } from "../lib/identity";
import { navigate, back } from "../lib/router";
import { Timeline } from "../components/feed/Timeline";
import { Content } from "../components/status/Content";
import { StatusCard } from "../components/status/StatusCard";
import { Avatar } from "../components/ui/Avatar";
import { EmojiText } from "../components/status/EmojiText";
import { Icon } from "../components/ui/Icon";
import { PageShell } from "../components/ui/PageShell";
import { ProfileEditor } from "../components/profile/ProfileEditor";
import { currentAccount, putStatuses, setCompose, statusKey } from "../state/store";
import { useAppState } from "../state/hooks";

type Tab = "posts" | "replies" | "media" | "followers" | "following";

interface Props {
  params: { instance?: string; id: string };
}

/** Loads the account, the viewer relationship and exposes the follow toggle. */
function useAccountProfile(instance: string, rawId: string) {
  const [account, setAccount] = useState<Account | null>(null);
  const [localId, setLocalId] = useState<string | null>(null);
  const [relationship, setRelationship] = useState<Relationship | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(async () => {
    if (!instance) return;
    setLoading(true);
    setError(null);
    const { client } = clientFor(instance);
    try {
      const acct = rawId.startsWith("@") ? rawId.slice(1) : rawId;
      const resolved =
        acct.includes("@") || /^\d+$/.test(acct)
          ? await client.v1.accounts.$select(acct).fetch()
          : await client.v1.accounts.lookup({ acct });
      setAccount(resolved);
      // The relationship lives on the account's instance; the profile may have
      // been loaded from another one, so resolve the local id first.
      const me = currentAccount();
      if (!me) {
        setLocalId(null);
        setRelationship(null);
        return;
      }
      const local = clientFor(me.instance).client;
      const resolvedLocalId = await localAccountId(local, me.instance, resolved, instance);
      setLocalId(resolvedLocalId);
      if (!resolvedLocalId) {
        setRelationship(null);
        return;
      }
      const rel = await local.v1.accounts.relationships.fetch({ id: [resolvedLocalId] });
      setRelationship(rel[0] ?? null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [instance, rawId]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleFollow = async (): Promise<void> => {
    if (!account || !relationship || !localId) return;
    const authed = currentAccount();
    if (!authed) {
      navigate("/login");
      return;
    }
    const client = clientFor(authed.instance).client;
    const selected = client.v1.accounts.$select(localId);
    const following = relationship.following || relationship.requested;
    setRelationship(following ? await selected.unfollow() : await selected.follow());
  };

  return { account, relationship, loading, error, toggleFollow, reload: load };
}

function followLabel(relationship: Relationship): string {
  if (relationship.requested) return t.followRequested;
  if (relationship.following) return t.unfollow;
  return t.follow;
}

function AccountActions({
  account,
  isSelf,
  canMention,
  relationship,
  onMention,
  onEdit,
  onFollow,
}: {
  account: Account | null;
  isSelf: boolean;
  canMention: boolean;
  relationship: Relationship | null;
  onMention: () => void;
  onEdit: () => void;
  onFollow: () => void;
}): JSX.Element | null {
  if (!account) return null;
  if (isSelf) {
    return (
      <button type="button" class="btn ghost" onClick={onEdit} aria-label={t.editProfile}>
        <Icon name="pencil-line" size={16} />
        {t.editProfile}
      </button>
    );
  }
  const following = relationship?.following || relationship?.requested;
  return (
    <>
      {canMention && (
        <button
          type="button"
          class="btn ghost"
          onClick={onMention}
          aria-label={`${t.mention}: @${account.acct}`}
        >
          <Icon name="at-line" size={16} />
          {t.mention}
        </button>
      )}
      {relationship && (
        <button type="button" class={`btn ${following ? "ghost" : "primary"}`} onClick={onFollow}>
          {followLabel(relationship)}
        </button>
      )}
    </>
  );
}

function AccountProfile({
  account,
  onTab,
}: {
  account: Account;
  onTab: (tab: Tab) => void;
}): JSX.Element {
  return (
    <div class="account-profile">
      <div class="account-hero">
        {account.header && <img class="account-header" src={account.header} alt="" />}
        <Avatar src={account.avatar} name={account.displayName || account.username} size={72} />
      </div>
      <h2 class="account-name">
        <EmojiText text={account.displayName || account.username} emojis={account.emojis} />
      </h2>
      <div class="muted handle">@{account.acct}</div>
      {account.note && (
        <div class="account-bio">
          <Content html={account.note} emojis={account.emojis} />
        </div>
      )}
      {account.fields.length > 0 && (
        <dl class="account-fields">
          {account.fields.map((field, index) => (
            <div class="account-field" key={`${field.name}-${index}`}>
              <dt>{field.name}</dt>
              <dd>
                {field.verifiedAt && (
                  <span class="field-verified" title={t.verified}>
                    <Icon name="check-line" size={12} />
                  </span>
                )}
                <Content html={field.value} emojis={account.emojis} />
              </dd>
            </div>
          ))}
        </dl>
      )}
      <div class="account-stats">
        <button type="button" class="stat" onClick={() => onTab("followers")}>
          <strong>{account.followersCount}</strong> {t.followers}
        </button>
        <button type="button" class="stat" onClick={() => onTab("following")}>
          <strong>{account.followingCount}</strong> {t.following}
        </button>
        <span class="stat">
          <strong>{account.statusesCount}</strong> {t.posts}
        </span>
      </div>
    </div>
  );
}

function AccountTabs({ tab, onTab }: { tab: Tab; onTab: (tab: Tab) => void }): JSX.Element {
  const tabs: [Tab, string][] = [
    ["posts", t.posts],
    ["replies", t.replies],
    ["media", t.media],
    ["followers", t.followers],
    ["following", t.following],
  ];
  return (
    <div class="subtabs">
      {tabs.map(([key, label]) => (
        <button
          key={key}
          type="button"
          class={`subtab ${tab === key ? "active" : ""}`}
          onClick={() => onTab(key)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** Posts tab: pinned statuses above the regular timeline (deduplicated). */
function AccountPostsTab({
  account,
  instance,
}: {
  account: Account;
  instance: string;
}): JSX.Element {
  const pinsRevision = useAppState().ui.pinsRevision;
  const [pinned, setPinned] = useState<Status[]>([]);

  useEffect(() => {
    let cancelled = false;
    setPinned([]);
    void (async () => {
      const { client } = clientFor(instance);
      try {
        const page = await client.v1.accounts
          .$select(account.id)
          .statuses.list({ pinned: true, limit: 5 });
        putStatuses(page, instance);
        if (!cancelled) setPinned(page);
      } catch (err) {
        console.warn("[oltn] pinned posts failed", err);
        if (!cancelled) setPinned([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [instance, account.id, pinsRevision]);

  const pinnedKeys = new Set(pinned.map(statusKey));
  return (
    <>
      {pinned.length > 0 && (
        <section class="pinned-posts">
          <h3 class="pinned-title">
            <Icon name="pin-fill" size={14} />
            {t.pinned}
          </h3>
          {pinned.map((status) => (
            <StatusCard key={statusKey(status)} statusKey={statusKey(status)} />
          ))}
        </section>
      )}
      <Timeline
        kind={{ type: "account", accountId: account.id, tab: "posts" }}
        instance={instance}
        emptyTitle={t.emptyProfile}
        excludeKeys={pinnedKeys}
      />
    </>
  );
}

function AccountTabBody({
  tab,
  account,
  instance,
  loading,
}: {
  tab: Tab;
  account: Account | null;
  instance: string;
  loading: boolean;
}): JSX.Element {
  if (!account || loading) {
    return (
      <div class="center-state">
        <span class="spinner" />
      </div>
    );
  }
  if (tab === "followers" || tab === "following") {
    return <AccountList instance={instance} kind={tab} accountId={account.id} />;
  }
  if (tab === "posts") {
    return <AccountPostsTab account={account} instance={instance} />;
  }
  return (
    <Timeline
      key={tab}
      kind={{
        type: "account",
        accountId: account.id,
        tab: tab as "replies" | "media",
      }}
      instance={instance}
      emptyTitle={t.emptyProfile}
    />
  );
}

export function AccountPage({ params }: Props): JSX.Element {
  const instance = params.instance ?? "";
  const [tab, setTab] = useState<Tab>("posts");
  const [editing, setEditing] = useState(false);
  const appState = useAppState();
  const { account, relationship, loading, error, toggleFollow, reload } = useAccountProfile(
    instance,
    params.id,
  );

  const isSelf =
    !!appState.me && !!account && appState.me.id === account.id && isOwnInstance(instance);
  const canMention = appState.auth === "authenticated" && !!account && !isSelf;
  const mentionAcct = account
    ? mentionHandleFor(account, instance, currentAccount()?.instance)
    : "";

  if (error && !account) {
    return (
      <PageShell title={t.profile} showBack>
        <div class="center-state">
          <Icon name="user-3-line" size={28} />
          <h3>{t.accountNotFound}</h3>
          <button type="button" class="btn ghost" onClick={() => back()}>
            <Icon name="back-line" size={16} />
            {t.back}
          </button>
        </div>
      </PageShell>
    );
  }

  return (
    <>
      <PageShell
        title={account?.displayName || account?.username || t.profile}
        subtitle={account ? `@${account.acct}` : undefined}
        showBack
        actions={
          <AccountActions
            account={account}
            isSelf={isSelf}
            canMention={canMention}
            relationship={relationship}
            onMention={() => {
              if (mentionAcct) setCompose({ mode: "new", prefill: `@${mentionAcct} ` });
            }}
            onEdit={() => setEditing(true)}
            onFollow={() => void toggleFollow()}
          />
        }
      >
        {account && <AccountProfile account={account} onTab={setTab} />}
        <AccountTabs tab={tab} onTab={setTab} />
        <AccountTabBody tab={tab} account={account} instance={instance} loading={loading} />
      </PageShell>
      {editing && account && (
        <ProfileEditor
          instance={instance}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            void reload();
          }}
        />
      )}
    </>
  );
}

interface AccountListProps {
  instance: string;
  kind: "followers" | "following";
  accountId: string;
}

function AccountList({ instance, kind, accountId }: AccountListProps): JSX.Element {
  const [list, setList] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { client } = clientFor(instance);
      try {
        const page =
          kind === "followers"
            ? await client.v1.accounts.$select(accountId).followers.list({ limit: 40 })
            : await client.v1.accounts.$select(accountId).following.list({ limit: 40 });
        if (!cancelled) setList(page);
      } catch (err) {
        console.warn("[oltn] follow list failed", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [instance, kind, accountId]);

  if (loading) {
    return (
      <div class="center-state">
        <span class="spinner" />
      </div>
    );
  }
  if (!list.length) {
    return (
      <div class="center-state">
        <Icon name="group-line" size={28} />
        <h3>{t.empty}</h3>
      </div>
    );
  }
  return (
    <div class="account-list">
      {list.map((account) => (
        <button
          key={account.id}
          type="button"
          class="list-row"
          onClick={() => navigate(`/${encodeURIComponent(instance)}/a/${account.id}`)}
        >
          <Avatar src={account.avatar} name={account.displayName || account.username} size={38} />
          <div class="row-main">
            <div class="row-title">
              <EmojiText text={account.displayName || account.username} emojis={account.emojis} />
            </div>
            <div class="row-sub">@{account.acct}</div>
          </div>
        </button>
      ))}
    </div>
  );
}
