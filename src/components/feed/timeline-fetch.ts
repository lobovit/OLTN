import type { RestClient, Status } from "../../api/types";
import type { FeedPage } from "../../lib/paged-feed";

export type TimelineKind =
  | { type: "home" }
  | { type: "public"; local?: boolean }
  | { type: "tag"; tag: string }
  | { type: "list"; listId: string }
  | {
      type: "account";
      accountId: string;
      tab?: "posts" | "replies" | "media" | "pinned";
    }
  | { type: "bookmarks" }
  | { type: "favourites" }
  | { type: "boosts" }
  | { type: "trending" };

export interface FetchCtx {
  client: RestClient;
  instance: string;
}

function paged(list: Status[], limit: number): FeedPage<Status> {
  return { items: list, hasMore: list.length >= limit };
}

/** Account tab filters mapped to the statuses endpoint params. */
function accountPageParams(tab: string, params: { limit: number; maxId?: string }) {
  return {
    ...params,
    excludeReplies: tab === "posts" || tab === "media" || tab === "pinned",
    excludeReblogs: tab === "posts",
    onlyMedia: tab === "media",
    pinned: tab === "pinned",
  };
}

/** Boosts feed: the Home timeline filtered to reblogs (see below). */
async function fetchBoostsPage(
  client: RestClient,
  limit: number,
  maxId: string | null,
): Promise<FeedPage<Status>> {
  // Mastodon excludes reblogs from public timelines (PublicFeed applies
  // without_reblogs_scope), so the only boosts feed the API allows is the
  // Home timeline filtered to boosts (same approach as Phanpy's catchup).
  const boosts: Status[] = [];
  let cursor = maxId;
  let hasMore = false;
  for (let page = 0; page < 4 && boosts.length < limit; page++) {
    const list = await client.v1.timelines.home.list({
      limit: 40,
      maxId: cursor ?? undefined,
    });
    hasMore = false;
    if (!list.length) break;
    cursor = list[list.length - 1].id;
    for (const status of list) {
      if (status.reblog && boosts.length < limit) boosts.push(status);
    }
    if (list.length < 40) break;
    hasMore = true;
  }
  return { items: boosts, hasMore };
}

/** Status page + this endpoint's "has more pages" rule. */
export async function fetchStatusPage(
  kind: TimelineKind,
  limit: number,
  maxId: string | null,
  ctx: FetchCtx,
): Promise<FeedPage<Status>> {
  const client = ctx.client;
  const params = { limit, maxId: maxId ?? undefined };

  switch (kind.type) {
    case "home":
      return paged(await client.v1.timelines.home.list(params), limit);
    case "public":
      return paged(
        await client.v1.timelines.public.list({ ...params, local: kind.local ?? false }),
        limit,
      );
    case "tag":
      return paged(await client.v1.timelines.tag.$select(kind.tag).list(params), limit);
    case "list":
      return paged(await client.v1.timelines.list.$select(kind.listId).list(params), limit);
    case "account":
      return paged(
        await client.v1.accounts
          .$select(kind.accountId)
          .statuses.list(accountPageParams(kind.tab ?? "posts", params)),
        limit,
      );
    case "bookmarks":
      return paged(await client.v1.bookmarks.list(params), limit);
    case "favourites":
      return paged(await client.v1.favourites.list(params), limit);
    case "boosts":
      return fetchBoostsPage(client, limit, maxId);
    case "trending":
      // Trending does not paginate — no "load more" button.
      return {
        items: await client.v1.trends.statuses.list({ limit }),
        hasMore: false,
      };
    default:
      return { items: [], hasMore: false };
  }
}
