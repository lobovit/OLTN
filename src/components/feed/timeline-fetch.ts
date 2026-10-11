import { getRest } from "../../api/client";
import type { Status } from "../../api/types";
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
  | { type: "boosts"; accountId: string }
  | { type: "trending" };

export interface FetchCtx {
  instance: string;
  accessToken?: string;
}

/** Status page + this endpoint's "has more pages" rule. */
export async function fetchStatusPage(
  kind: TimelineKind,
  limit: number,
  maxId: string | null,
  ctx: FetchCtx,
): Promise<FeedPage<Status>> {
  const client = getRest(ctx.instance, ctx.accessToken);
  const params = { limit, maxId: maxId ?? undefined };
  const paged = (list: Status[]): FeedPage<Status> => ({
    items: list,
    hasMore: list.length >= limit,
  });

  switch (kind.type) {
    case "home":
      return paged(await client.v1.timelines.home.list(params));
    case "public":
      return paged(
        await client.v1.timelines.public.list({ ...params, local: kind.local ?? false }),
      );
    case "tag":
      return paged(await client.v1.timelines.tag.$select(kind.tag).list(params));
    case "list":
      return paged(await client.v1.timelines.list.$select(kind.listId).list(params));
    case "account": {
      const tab = kind.tab ?? "posts";
      return paged(
        await client.v1.accounts.$select(kind.accountId).statuses.list({
          ...params,
          excludeReplies: tab === "posts" || tab === "media" || tab === "pinned",
          excludeReblogs: tab === "posts",
          onlyMedia: tab === "media",
          pinned: tab === "pinned",
        }),
      );
    }
    case "bookmarks":
      return paged(await client.v1.bookmarks.list(params));
    case "favourites":
      return paged(await client.v1.favourites.list(params));
    case "boosts": {
      // The API has no boosts-only endpoint: pages the profile posts and filters.
      const boosts: Status[] = [];
      let cursor = maxId;
      let hasMore = false;
      for (let page = 0; page < 4 && boosts.length < limit; page++) {
        const list = await client.v1.accounts.$select(kind.accountId).statuses.list({
          limit: 40,
          maxId: cursor ?? undefined,
          excludeReplies: true,
          excludeReblogs: false,
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
