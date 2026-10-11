import type { JSX } from "preact";
import { useSnapshot } from "valtio";
import { t } from "../../i18n/pt-BR";
import { navigate } from "../../lib/router";
import { getRest } from "../../api/client";
import type { Notification, Status } from "../../api/types";
import { currentAccount, putStatuses, statusKey, store } from "../../state/store";
import { usePagedFeed } from "../../state/hooks";
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

function groupNotifications(list: readonly Notification[]): Group[] {
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
  const snap = useSnapshot(store);
  const account = currentAccount();
  const queue = snap.notifQueue
    .filter((n) => mode === "all" || n.type === "mention")
    .map((n) => n as unknown as Notification);

  const feed = usePagedFeed<Notification>({
    key: `${instance}|${mode}`,
    enabled: !!account,
    adapter: {
      fetchPage: async (cursor) => {
        const token = account && account.instance === instance ? account.accessToken : undefined;
        const page = await getRest(instance, token).v1.notifications.list({
          limit: 20,
          maxId: cursor ?? undefined,
          types: mode === "mentions" ? ["mention"] : undefined,
        });
        putStatuses(
          page.map((n) => n.status).filter((s): s is Status => !!s),
          instance,
        );
        return { items: page, hasMore: page.length >= 20 };
      },
      keyOf: (notification) => notification.id,
      cursorOf: (notification) => notification.id,
    },
    queue,
    queueMode: "auto",
    onReady: (items) => {
      if (mode === "all") store.notifBadge = 0;
      const ids = new Set(items.map((n) => n.id));
      store.notifQueue = store.notifQueue.filter((n) => !ids.has(n.id));
    },
  });

  const groups = groupNotifications(feed.items);

  if (feed.loading && !feed.items.length) return <TimelineSkeleton />;

  if (feed.error && !feed.items.length) {
    return (
      <div class="center-state">
        <Icon name="wifi-off-line" size={28} />
        <h3>{t.errorLoad}</h3>
        <button type="button" class="btn ghost" onClick={feed.reload}>
          <Icon name="refresh-2-line" size={16} />
          {t.retry}
        </button>
      </div>
    );
  }

  if (!feed.items.length) {
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
      {feed.moreError ? (
        <div class="load-more load-more-error">
          <span class="muted">{t.errorLoad}</span>
          <button type="button" class="btn ghost" onClick={feed.loadMore}>
            <Icon name="refresh-2-line" size={16} />
            {t.retry}
          </button>
        </div>
      ) : (
        feed.hasMore && (
          <div class="load-more">
            <button
              type="button"
              class="btn ghost"
              disabled={feed.loadingMore}
              onClick={feed.loadMore}
            >
              {feed.loadingMore ? (
                <span class="spinner" />
              ) : (
                <Icon name="dropdown-line" size={16} />
              )}
              {feed.loadingMore ? t.loadingMore : t.loadMore}
            </button>
          </div>
        )
      )}
    </div>
  );
}
