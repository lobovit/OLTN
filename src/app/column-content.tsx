import type { JSX } from "preact";
import type { Shortcut } from "../api/types";
import { ConversationsFeed } from "../components/feed/ConversationsFeed";
import { NotificationsFeed } from "../components/feed/NotificationsFeed";
import { Timeline } from "../components/feed/Timeline";
import { TrendingFeed } from "../components/feed/TrendingFeed";
import { t } from "../i18n/pt-BR";

export function iconForShortcut(shortcut: Shortcut): string {
  switch (shortcut.type) {
    case "home":
      return "home-3-line";
    case "local":
      return "globe-line";
    case "federated":
      return "rocket-line";
    case "notifications":
      return "notification-line";
    case "mentions":
      return "at-line";
    case "direct":
      return "mail-line";
    case "bookmarks":
      return "bookmark-line";
    case "favourites":
      return "heart-line";
    case "boosts":
      return "repeat-line";
    case "trending":
      return "trending-up-line";
    case "list":
      return "list-check-line";
    case "hashtag":
      return "hashtag-line";
    default:
      return "quill-pen-line";
  }
}

export function ColumnContent({
  shortcut,
  instance,
}: {
  shortcut: Shortcut;
  instance?: string;
}): JSX.Element {
  switch (shortcut.type) {
    case "home":
      return <Timeline kind={{ type: "home" }} instance={instance} listenQueue />;
    case "local":
      return <Timeline kind={{ type: "public", local: true }} instance={instance} />;
    case "federated":
      return <Timeline kind={{ type: "public" }} instance={instance} />;
    case "notifications":
      return instance ? <NotificationsFeed instance={instance} /> : <div />;
    case "mentions":
      return instance ? <NotificationsFeed instance={instance} mode="mentions" /> : <div />;
    case "direct":
      return instance ? <ConversationsFeed instance={instance} /> : <div />;
    case "bookmarks":
      return <Timeline kind={{ type: "bookmarks" }} instance={instance} />;
    case "favourites":
      return <Timeline kind={{ type: "favourites" }} instance={instance} />;
    case "boosts":
      return <Timeline kind={{ type: "boosts" }} instance={instance} emptyTitle={t.emptyBoosts} />;
    case "trending":
      return <TrendingFeed instance={instance} />;
    case "list":
      return <Timeline kind={{ type: "list", listId: shortcut.value ?? "" }} instance={instance} />;
    case "hashtag":
      return <Timeline kind={{ type: "tag", tag: shortcut.value ?? "" }} instance={instance} />;
    default:
      return <div />;
  }
}
