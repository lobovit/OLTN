import { describe, expect, it } from "vitest";
import type { Account, Status } from "../../api/types";
import {
  buildTimeseriesItems,
  engagementOf,
  sortTimeseries,
  timeseriesAuthors,
  topTimeseriesLinks,
} from "../timeseries";

function account(id: string, name = id): Account {
  return {
    id,
    username: name,
    acct: name,
    displayName: name.toUpperCase(),
    avatar: "",
    avatarStatic: "",
    emojis: [],
  } as unknown as Account;
}

function status(id: string, over: Partial<Status> = {}): Status {
  return {
    id,
    uri: `https://example.test/statuses/${id}`,
    createdAt: "2026-10-31T12:00:00Z",
    account: account(`a-${id}`, `user${id}`),
    content: `<p>post ${id}</p>`,
    inReplyToId: null,
    reblog: null,
    mediaAttachments: [],
    mentions: [],
    tags: [],
    emojis: [],
    favouritesCount: 0,
    reblogsCount: 0,
    repliesCount: 0,
    quotesCount: 0,
    filtered: [],
    card: null,
    ...over,
  } as unknown as Status;
}

describe("buildTimeseriesItems", () => {
  it("classifies originals, replies and boosts using the boosted post", () => {
    const inner = status("inner", { account: account("ana", "ana") });
    const items = buildTimeseriesItems([
      status("1"),
      status("2", { inReplyToId: "1" }),
      status("3", { reblog: inner, account: account("booster", "booster") }),
    ]);
    expect(items.map((item) => item.category)).toEqual(["original", "reply", "boost"]);
    expect(items[2].target.account.username).toBe("ana");
  });

  it("classifies quote posts before replies", () => {
    const quote = status("4", {
      inReplyToId: "1",
      quote: { state: "accepted", quotedStatus: null } as unknown as Status["quote"],
    });
    expect(buildTimeseriesItems([quote])[0].category).toBe("quote");
  });

  it("drops blocked authors, hidden filters and duplicate wrappers", () => {
    const hidden = status("2", {
      filtered: [{ filter: { filterAction: "hide" } }] as unknown as Status["filtered"],
    });
    const items = buildTimeseriesItems(
      [status("1"), status("1"), hidden, status("3", { account: account("bob", "bob") })],
      ["bob"],
    );
    expect(items.map((item) => item.status.id)).toEqual(["1"]);
  });
});

describe("timeseries sorting and summaries", () => {
  it("sorts by recent time or engagement", () => {
    const older = status("1", { createdAt: "2026-10-31T10:00:00Z", favouritesCount: 20 });
    const newer = status("2", { createdAt: "2026-10-31T12:00:00Z", favouritesCount: 1 });
    const items = buildTimeseriesItems([older, newer]);
    expect(sortTimeseries(items, "recent").map((item) => item.status.id)).toEqual(["2", "1"]);
    expect(sortTimeseries(items, "engagement").map((item) => item.status.id)).toEqual(["1", "2"]);
    expect(engagementOf(items[0])).toBe(20);
  });

  it("sorts by each engagement metric", () => {
    const items = buildTimeseriesItems([
      status("replies", { repliesCount: 5 }),
      status("likes", { favouritesCount: 9 }),
      status("boosts", { reblogsCount: 4 }),
      status("quotes", { quotesCount: 2 }),
    ]);
    expect(sortTimeseries(items, "replies")[0].status.id).toBe("replies");
    expect(sortTimeseries(items, "favourites")[0].status.id).toBe("likes");
    expect(sortTimeseries(items, "boosts")[0].status.id).toBe("boosts");
    expect(sortTimeseries(items, "quotes")[0].status.id).toBe("quotes");
  });

  it("counts authors and aggregates top links", () => {
    const card = {
      url: "https://news.example/a",
      title: "A",
      providerName: "news.example",
    } as unknown as NonNullable<Status["card"]>;
    const items = buildTimeseriesItems([
      status("1", { account: account("ana", "ana"), card }),
      status("2", { account: account("ana", "ana"), card }),
      status("3", { account: account("bob", "bob") }),
    ]);
    expect(timeseriesAuthors(items).map((entry) => [entry.account.username, entry.count])).toEqual([
      ["ana", 2],
      ["bob", 1],
    ]);
    expect(topTimeseriesLinks(items)).toEqual([
      {
        url: "https://news.example/a",
        title: "A",
        description: "",
        image: null,
        provider: "news.example",
        count: 2,
      },
    ]);
  });
});
