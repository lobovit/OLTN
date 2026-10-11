import type { JSX } from "preact";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { useSnapshot } from "valtio";
import { t } from "../../i18n/pt-BR";
import { navigate } from "../../lib/router";
import { getRest } from "../../api/client";
import type { Notification, Status } from "../../api/types";
import { currentAccount, putStatuses, statusKey, store } from "../../state/store";
import { StatusCard } from "../status/StatusCard";
import { EmojiText } from "../status/EmojiText";
import { Avatar } from "../ui/Avatar";
import { Icon } from "../ui/Icon";
import { TimelineSkeleton } from "../feed/Timeline";

const TYPE_ICON: Record<string, string> = {
  mention: "at-line",
  status: "quill-pen-line",
  reblog: "repeat-line",
  favourite: "heart-fill",
  follow: "user-3-line",
  follow_request: "user-3-line",
  poll: "list-check-line",
  update: "history-line",
  severed_relationships: "unlink-line",
  moderation_warning: "information-line",
};

function typeText(type: string): string {
  switch (type) {
    case "mention":
      return t.notifMention;
    case "status":
      return t.notifPosted;
    case "reblog":
      return t.notifReblog;
    case "favourite":
      return t.notifFavourite;
    case "follow":
      return t.notifFollow;
    case "follow_request":
      return t.notifFollowRequest;
    case "poll":
      return t.notifPoll;
    case "update":
      return t.notifUpdate;
    case "severed_relationships":
      return t.notifSevered;
    case "moderation_warning":
      return t.notifModeration;
    default:
      return t.notifGeneric;
  }
}

interface Group {
  key: string;
  type: string;
  accountId: string;
  account: Notification["account"];
  items: Notification[];
}

function groupNotifications(list: Notification[]): Group[] {
  const groups: Group[] = [];
  for (const n of list) {
    const last = groups[groups.length - 1];
    if (last && last.type === n.type && last.accountId === n.account.id) {
      last.items.push(n);
    } else {
      groups.push({
        key: n.id,
        type: n.type,
        accountId: n.account.id,
        account: n.account,
        items: [n],
      });
    }
  }
  return groups;
}

export function accountHref(acct: string, instance: string): string {
  const [user, host] = acct.includes("@")
    ? [acct.slice(0, acct.indexOf("@")), acct.slice(acct.indexOf("@") + 1)]
    : [acct, instance];
  return `/${encodeURIComponent(host || instance)}/a/${encodeURIComponent(user)}`;
}

interface NotificationsFeedProps {
  instance: string;
  mode?: "all" | "mentions";
}

export function NotificationsFeed({ instance, mode = "all" }: NotificationsFeedProps): JSX.Element {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const lastIdRef = useRef<string | null>(null);
  const queue = useSnapshot(store).notifQueue;
  const seenRef = useRef<Set<string>>(new Set());

  // Inserts notifications received via streaming at the top of the list.
  useEffect(() => {
    if (loading) return;
    const fresh = store.notifQueue.filter(
      (n) => (mode === "all" || n.type === "mention") && !seenRef.current.has(n.id),
    );
    if (!fresh.length) return;
    for (const n of fresh) seenRef.current.add(n.id);
    setItems((prev) => [...fresh.filter((n) => !prev.some((p) => p.id === n.id)), ...prev]);
  }, [queue, loading, mode]);

  const load = useCallback(
    async (maxId?: string) => {
      const client = getRest(instance, currentAccount()?.accessToken);
      try {
        const page = await client.v1.notifications.list({
          limit: 20,
          maxId,
          types: mode === "mentions" ? ["mention"] : undefined,
        });
        const statuses = page.map((n) => n.status).filter((s): s is Status => !!s);
        putStatuses(statuses);
        lastIdRef.current = page.length ? page[page.length - 1].id : null;
        if (!maxId) {
          const pageIds = new Set(page.map((n) => n.id));
          store.notifQueue = store.notifQueue.filter((n) => !pageIds.has(n.id));
          setItems(page);
          setHasMore(page.length >= 20);
        } else {
          setItems((prev) => [...prev, ...page]);
          if (page.length < 20) setHasMore(false);
        }
        setError(null);
      } catch (err) {
        if (!maxId) setError(err);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [instance, mode],
  );

  useEffect(() => {
    setLoading(true);
    void load();
    if (mode === "all") store.notifBadge = 0;
  }, [load, mode]);

  const groups = groupNotifications(items);

  if (loading && !items.length) return <TimelineSkeleton />;

  if (error && !items.length) {
    return (
      <div class="center-state">
        <Icon name="wifi-off-line" size={28} />
        <h3>{t.errorLoad}</h3>
        <button type="button" class="btn ghost" onClick={() => void load()}>
          <Icon name="refresh-2-line" size={16} />
          {t.retry}
        </button>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div class="center-state">
        <Icon name="notification-line" size={28} />
        <h3>{mode === "mentions" ? t.emptyMentions : t.emptyNotifications}</h3>
        <p>{t.emptyHint}</p>
      </div>
    );
  }

  return (
    <div class="notifications">
      {groups.map((group) => {
        const first = group.items[0];
        const status = first.status;
        const repeated = group.items.length > 1;
        const time = new Date(first.createdAt);
        return (
          <div class={`notif-group type-${group.type}`} key={group.key}>
            <button
              type="button"
              class="notif-head"
              onClick={() => navigate(accountHref(group.account.acct, instance))}
            >
              <span class="notif-icon">
                <Icon name={TYPE_ICON[group.type] ?? "notification-line"} size={14} />
              </span>
              <Avatar
                src={group.account.avatar}
                name={group.account.displayName || group.account.username}
                size={34}
              />
              <span class="notif-text">
                <strong>
                  <EmojiText
                    text={group.account.displayName || group.account.username}
                    emojis={group.account.emojis}
                  />
                </strong>{" "}
                {typeText(group.type)}
                {repeated && <span class="notif-count"> +{group.items.length - 1}</span>}
              </span>
              <span class="notif-time muted">
                {time.toLocaleDateString(undefined, { day: "numeric", month: "short" })}
              </span>
            </button>
            {status && <StatusCard statusKey={statusKey(status)} compact hideHeader />}
          </div>
        );
      })}
      {hasMore && (
        <div class="load-more">
          <button
            type="button"
            class="btn ghost"
            disabled={loadingMore}
            onClick={() => {
              setLoadingMore(true);
              void load(lastIdRef.current ?? undefined);
            }}
          >
            {loadingMore ? <span class="spinner" /> : <Icon name="dropdown-line" size={16} />}
            {loadingMore ? t.loadingMore : t.loadMore}
          </button>
        </div>
      )}
    </div>
  );
}
