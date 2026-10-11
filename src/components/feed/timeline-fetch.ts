import { getRest } from "../../api/client";
import type { Status } from "../../api/types";

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

export interface PageArgs {
  maxId?: string;
  sinceId?: string;
  limit?: number;
}

export interface FetchCtx {
  instance: string;
  accessToken?: string;
}

export async function fetchStatusPage(
  kind: TimelineKind,
  args: PageArgs,
  ctx: FetchCtx,
): Promise<Status[]> {
  const client = getRest(ctx.instance, ctx.accessToken);
  const params = { limit: args.limit ?? 20, maxId: args.maxId, sinceId: args.sinceId };

  switch (kind.type) {
    case "home":
      return client.v1.timelines.home.list(params);
    case "public":
      return client.v1.timelines.public.list({ ...params, local: kind.local ?? false });
    case "tag":
      return client.v1.timelines.tag.$select(kind.tag).list(params);
    case "list":
      return client.v1.timelines.list.$select(kind.listId).list(params);
    case "account": {
      const tab = kind.tab ?? "posts";
      return client.v1.accounts.$select(kind.accountId).statuses.list({
        ...params,
        excludeReplies: tab === "posts" || tab === "media" || tab === "pinned",
        excludeReblogs: tab === "posts",
        onlyMedia: tab === "media",
        pinned: tab === "pinned",
      });
    }
    case "bookmarks":
      return client.v1.bookmarks.list(params);
    case "favourites":
      return client.v1.favourites.list(params);
    case "boosts": {
      // A API não tem endpoint só de boosts: pagina os posts do perfil e filtra.
      const limit = args.limit ?? 20;
      const boosts: Status[] = [];
      let maxId = args.maxId;
      for (let page = 0; page < 4 && boosts.length < limit; page++) {
        const list = await client.v1.accounts.$select(kind.accountId).statuses.list({
          limit: 40,
          maxId,
          excludeReplies: true,
          excludeReblogs: false,
        });
        if (!list.length) break;
        maxId = list[list.length - 1].id;
        for (const status of list) {
          if (status.reblog && boosts.length < limit) boosts.push(status);
        }
        if (list.length < 40) break;
      }
      return boosts;
    }
    case "trending":
      return client.v1.trends.statuses.list({ limit: args.limit ?? 20 });
    default:
      return [];
  }
}
