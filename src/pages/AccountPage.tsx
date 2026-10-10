import type { JSX } from "preact";
import { useCallback, useEffect, useState } from "preact/hooks";
import { getRest } from "../api/client";
import type { Account, Relationship } from "../api/types";
import { t } from "../i18n/pt-BR";
import { navigate, back } from "../lib/router";
import { Timeline } from "../components/feed/Timeline";
import { Content } from "../components/status/Content";
import { Avatar } from "../components/ui/Avatar";
import { EmojiText } from "../components/status/EmojiText";
import { Icon } from "../components/ui/Icon";
import { PageShell } from "../components/ui/PageShell";
import { ProfileEditor } from "../components/profile/ProfileEditor";
import { currentAccount } from "../state/store";
import { useAppState } from "../state/hooks";

type Tab = "posts" | "replies" | "media" | "followers" | "following";

interface Props {
  params: { instance?: string; id: string };
}

export function AccountPage({ params }: Props): JSX.Element {
  const instance = params.instance ?? "";
  const rawId = params.id;
  const [account, setAccount] = useState<Account | null>(null);
  const [relationship, setRelationship] = useState<Relationship | null>(null);
  const [tab, setTab] = useState<Tab>("posts");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [editing, setEditing] = useState(false);
  const appState = useAppState();
  const me = appState.me;

  const load = useCallback(async () => {
    if (!instance) return;
    setLoading(true);
    setError(null);
    const authed = currentAccount();
    const token = authed?.instance === instance ? authed.accessToken : undefined;
    const client = getRest(instance, token);
    try {
      let acct = rawId.startsWith("@") ? rawId.slice(1) : rawId;
      let resolved: Account;
      if (acct.includes("@") || /^\d+$/.test(acct)) {
        resolved = await client.v1.accounts.$select(acct).fetch();
      } else {
        resolved = await client.v1.accounts.lookup({ acct });
      }
      setAccount(resolved);
      if (token) {
        const rel = await client.v1.accounts.relationships.fetch({ id: [resolved.id] });
        setRelationship(rel[0] ?? null);
      } else {
        setRelationship(null);
      }
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [instance, rawId]);

  useEffect(() => {
    void load();
  }, [load]);

  const isSelf =
    !!me && !!account && me.id === account.id && currentAccount()?.instance === instance;

  const toggleFollow = async (): Promise<void> => {
    if (!account || !relationship) return;
    const authed = currentAccount();
    if (!authed) {
      navigate("/login");
      return;
    }
    const client = getRest(authed.instance, authed.accessToken);
    const rel =
      relationship.following || relationship.requested
        ? await client.v1.accounts.$select(account.id).unfollow()
        : await client.v1.accounts.$select(account.id).follow();
    setRelationship(rel);
  };

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
          account ? (
            isSelf ? (
              <button
                type="button"
                class="btn ghost"
                onClick={() => setEditing(true)}
                aria-label={t.editProfile}
              >
                <Icon name="pencil-line" size={16} />
                {t.editProfile}
              </button>
            ) : relationship ? (
              <button
                type="button"
                class={`btn ${relationship.following || relationship.requested ? "ghost" : "primary"}`}
                onClick={() => void toggleFollow()}
              >
                {relationship.requested
                  ? t.followRequested
                  : relationship.following
                    ? t.unfollow
                    : t.follow}
              </button>
            ) : null
          ) : null
        }
      >
        {account && (
          <div class="account-profile">
            <div class="account-hero">
              {account.header && <img class="account-header" src={account.header} alt="" />}
              <Avatar
                src={account.avatar}
                name={account.displayName || account.username}
                size={72}
              />
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
            <div class="account-stats">
              <button type="button" class="stat" onClick={() => setTab("followers")}>
                <strong>{account.followersCount}</strong> {t.followers}
              </button>
              <button type="button" class="stat" onClick={() => setTab("following")}>
                <strong>{account.followingCount}</strong> {t.following}
              </button>
              <span class="stat">
                <strong>{account.statusesCount}</strong> {t.posts}
              </span>
            </div>
          </div>
        )}
        <div class="subtabs">
          {(
            [
              ["posts", t.posts],
              ["replies", t.replies],
              ["media", t.media],
              ["followers", t.followers],
              ["following", t.following],
            ] as [Tab, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              class={`subtab ${tab === key ? "active" : ""}`}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>
        {account && !loading ? (
          tab === "followers" || tab === "following" ? (
            <AccountList
              instance={instance}
              kind={tab === "followers" ? "followers" : "following"}
              accountId={account.id}
            />
          ) : (
            <Timeline
              key={tab}
              kind={{
                type: "account",
                accountId: account.id,
                tab: tab as "posts" | "replies" | "media",
              }}
              instance={instance}
              emptyTitle={t.emptyProfile}
            />
          )
        ) : (
          <div class="center-state">
            <span class="spinner" />
          </div>
        )}
      </PageShell>
      {editing && account && (
        <ProfileEditor
          instance={instance}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            void load();
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
      const authed = currentAccount();
      const client = getRest(
        instance,
        authed && authed.instance === instance ? authed.accessToken : undefined,
      );
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
