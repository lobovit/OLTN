/* Timeseries helpers: classify, filter, sort and summarize a Home window. */

import type { Account, Status } from "../api/types";

export type TimeseriesCategory = "original" | "reply" | "boost" | "quote";
export type TimeseriesSort =
  | "recent"
  | "engagement"
  | "replies"
  | "favourites"
  | "boosts"
  | "quotes";

export interface TimeseriesItem {
  key: string;
  /** Timeline wrapper (boost) or the post itself. */
  status: Status;
  /** Unwrapped post used for content and author. */
  target: Status;
  category: TimeseriesCategory;
  time: number;
}

export interface TimeseriesAuthor {
  account: Account;
  count: number;
}

export interface TimeseriesLink {
  url: string;
  title: string;
  description: string;
  image: string | null;
  provider: string;
  count: number;
}

function keyOf(status: Status): string {
  return status.uri || String(status.id);
}

function isHidden(status: Status): boolean {
  return !!status.filtered?.some(
    (result) => result.filter && result.filter.filterAction === "hide",
  );
}

export function buildTimeseriesItems(
  statuses: readonly Status[],
  blocked: readonly string[] = [],
): TimeseriesItem[] {
  const blockedAccts = new Set(blocked.map((acct) => acct.toLowerCase()));
  const seen = new Set<string>();
  const items: TimeseriesItem[] = [];
  for (const status of statuses) {
    const key = keyOf(status);
    if (seen.has(key)) continue;
    const target = status.reblog ?? status;
    if (!target.account) continue;
    if (blockedAccts.has(status.account.acct.toLowerCase())) continue;
    if (blockedAccts.has(target.account.acct.toLowerCase())) continue;
    if (isHidden(target)) continue;
    seen.add(key);
    const category: TimeseriesCategory = status.reblog
      ? "boost"
      : target.quote
        ? "quote"
        : status.inReplyToId
          ? "reply"
          : "original";
    items.push({
      key,
      status,
      target,
      category,
      time: Date.parse(status.createdAt) || 0,
    });
  }
  return items;
}

export function engagementOf(item: TimeseriesItem): number {
  const status = item.target;
  return (
    (status.favouritesCount ?? 0) +
    (status.reblogsCount ?? 0) * 2 +
    (status.repliesCount ?? 0) +
    (status.quotesCount ?? 0)
  );
}

function sortValue(item: TimeseriesItem, sort: Exclude<TimeseriesSort, "recent">): number {
  switch (sort) {
    case "replies":
      return item.target.repliesCount ?? 0;
    case "favourites":
      return item.target.favouritesCount ?? 0;
    case "boosts":
      return item.target.reblogsCount ?? 0;
    case "quotes":
      return item.target.quotesCount ?? 0;
    default:
      return engagementOf(item);
  }
}

export function sortTimeseries(
  items: readonly TimeseriesItem[],
  sort: TimeseriesSort,
): TimeseriesItem[] {
  const next = [...items];
  if (sort === "recent") {
    next.sort((a, b) => b.time - a.time);
    return next;
  }
  next.sort((a, b) => sortValue(b, sort) - sortValue(a, sort) || b.time - a.time);
  return next;
}

/** Authors ordered by number of posts in the window. */
export function timeseriesAuthors(items: readonly TimeseriesItem[]): TimeseriesAuthor[] {
  const byId = new Map<string, TimeseriesAuthor>();
  for (const item of items) {
    const account = item.target.account;
    const entry = byId.get(account.id);
    if (entry) entry.count += 1;
    else byId.set(account.id, { account, count: 1 });
  }
  return [...byId.values()].sort(
    (a, b) =>
      b.count - a.count ||
      (a.account.displayName || a.account.username).localeCompare(
        b.account.displayName || b.account.username,
      ),
  );
}

/** Preview cards shared by the most posts in the window. */
export function topTimeseriesLinks(items: readonly TimeseriesItem[], limit = 4): TimeseriesLink[] {
  const byUrl = new Map<string, TimeseriesLink>();
  for (const item of items) {
    const card = item.target.card;
    if (!card?.url) continue;
    const existing = byUrl.get(card.url);
    if (existing) {
      existing.count += 1;
      continue;
    }
    byUrl.set(card.url, {
      url: card.url,
      title: card.title || card.url,
      description: card.description || "",
      image: card.image ?? null,
      provider: card.providerName || "",
      count: 1,
    });
  }
  return [...byUrl.values()]
    .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title))
    .slice(0, limit);
}
