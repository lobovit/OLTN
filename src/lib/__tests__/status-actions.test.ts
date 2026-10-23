import { beforeEach, describe, expect, it } from "vitest";
import type { Poll, RestClient, Status } from "../../api/types";
import {
  blockStatusAuthor,
  deleteStatus,
  reportStatus,
  toggleStatusAction,
  toggleStatusPin,
  votePoll,
  type StatusActionsContext,
} from "../../state/status-actions";
import { putStatus, statusKey, store } from "../../state/store";

function makeStatus(id: string, over: Partial<Status> = {}): Status {
  return {
    id,
    uri: `https://mock.instance/users/u/statuses/${id}`,
    url: `https://mock.instance/@u/${id}`,
    created_at: new Date().toISOString(),
    content: "<p>x</p>",
    account: {
      id: "a2",
      acct: "u@remote.example",
      username: "u",
      displayName: "U",
      avatar: "",
      avatarStatic: "",
      emojis: [],
    },
    reblogsCount: 0,
    favouritesCount: 0,
    repliesCount: 0,
    favourited: false,
    reblogged: false,
    bookmarked: false,
    mediaAttachments: [],
    mentions: [],
    tags: [],
    emojis: [],
    ...over,
  } as unknown as Status;
}

interface FakeClientOptions {
  failOn?: string;
  remote?: boolean;
  favourite?: () => Promise<unknown>;
}

function fakeClient(options: FakeClientOptions = {}) {
  const calls: string[] = [];
  let reportParams: unknown;
  const maybeFail = async (label: string, result: unknown = {}): Promise<unknown> => {
    calls.push(label);
    if (options.failOn && label.startsWith(options.failOn)) throw new Error(`falha em ${label}`);
    return result;
  };
  const client = {
    v1: {
      statuses: {
        $select: (id: string) => ({
          favourite: () => options.favourite?.() ?? maybeFail(`fav:${id}`),
          unfavourite: () => maybeFail(`unfav:${id}`),
          reblog: () => maybeFail(`boost:${id}`),
          unreblog: () => maybeFail(`unboost:${id}`),
          bookmark: () => maybeFail(`bookmark:${id}`),
          unbookmark: () => maybeFail(`unbookmark:${id}`),
          pin: () => maybeFail(`pin:${id}`, makeStatus(id, { pinned: true })),
          unpin: () => maybeFail(`unpin:${id}`, makeStatus(id, { pinned: false })),
          remove: () => maybeFail(`delete:${id}`),
        }),
      },
      accounts: {
        $select: (id: string) => ({
          block: () => maybeFail(`block:${id}`),
          mute: () => maybeFail(`mute:${id}`),
        }),
      },
      reports: {
        create: (params?: unknown) => {
          reportParams = params;
          return maybeFail("report", { id: "r1" });
        },
      },
      polls: {
        $select: (id: string) => ({
          votes: {
            create: () =>
              maybeFail(`vote:${id}`, {
                id,
                voted: true,
                expired: false,
                options: [],
              } as unknown as Poll),
          },
        }),
      },
    },
    v2: {
      search: {
        list: async () => ({
          accounts: options.remote ? [{ id: "a-local" }] : [],
          hashtags: [],
          statuses: options.remote
            ? [makeStatus("L9", { uri: "https://remote.example/users/u/statuses/77" })]
            : [],
        }),
      },
    },
  };
  return { client: client as unknown as RestClient, calls, reportParams: () => reportParams };
}

const ctx = (client: RestClient): StatusActionsContext => ({
  client,
  instance: "mock.instance",
});

const lastToast = () => store.ui.toasts[store.ui.toasts.length - 1];

beforeEach(() => {
  store.statuses = {};
  store.statusSources = {};
  store.blockedAccounts = [];
  store.ui.toasts = [];
  store.ui.boostsRevision = 0;
  store.ui.pinsRevision = 0;
  store.instance = null;
});

describe("toggleStatusPin", () => {
  it("pins and unpins the status, bumping the profile revision", async () => {
    const { client, calls } = fakeClient();
    const key = putStatus(makeStatus("1", { pinned: false }), "mock.instance");

    expect(await toggleStatusPin(ctx(client), key)).toBe(true);
    expect(store.statuses[key]?.pinned).toBe(true);
    expect(store.ui.pinsRevision).toBe(1);
    expect(lastToast()?.text).toBe("Pinned to profile.");

    expect(await toggleStatusPin(ctx(client), key)).toBe(true);
    expect(store.statuses[key]?.pinned).toBe(false);
    expect(store.ui.pinsRevision).toBe(2);
    expect(lastToast()?.text).toBe("Removed from profile.");
    expect(calls).toEqual(["pin:1", "unpin:1"]);
  });

  it("shows the server error and keeps the state on failure", async () => {
    const { client } = fakeClient({ failOn: "pin:" });
    const key = putStatus(makeStatus("1", { pinned: false }), "mock.instance");

    expect(await toggleStatusPin(ctx(client), key)).toBe(false);
    expect(store.statuses[key]?.pinned).toBe(false);
    expect(store.ui.pinsRevision).toBe(0);
    expect(lastToast()?.text).toBe("That didn't work. Try again.");
  });
});

describe("toggleStatusAction", () => {
  it("curte de forma otimista e confirma na API", async () => {
    const { client, calls } = fakeClient();
    const key = putStatus(makeStatus("1"), "mock.instance");
    await toggleStatusAction(ctx(client), key, "fav");
    expect(store.statuses[key]?.favourited).toBe(true);
    expect(store.statuses[key]?.favouritesCount).toBe(1);
    expect(calls).toEqual(["fav:1"]);
    expect(store.ui.toasts).toHaveLength(0);
  });

  it("reverts the optimistic state when the API fails", async () => {
    const { client } = fakeClient({ failOn: "fav:" });
    const key = putStatus(makeStatus("1"), "mock.instance");
    const ok = await toggleStatusAction(ctx(client), key, "fav");
    expect(ok).toBe(false);
    expect(store.statuses[key]?.favourited).toBe(false);
    expect(store.statuses[key]?.favouritesCount).toBe(0);
    expect(lastToast()?.kind).toBe("error");
  });

  it("ignores a double click while the action is in flight", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const favourite = async (): Promise<unknown> => {
      await gate;
      return makeStatus("1", { favourited: true });
    };
    const { client } = fakeClient({ favourite });
    const key = putStatus(makeStatus("1"), "mock.instance");

    const first = toggleStatusAction(ctx(client), key, "fav");
    const second = await toggleStatusAction(ctx(client), key, "fav");
    expect(second).toBe(false);

    release();
    expect(await first).toBe(true);
    expect(store.statuses[key]?.favourited).toBe(true);
  });

  it("removes a boost optimistically and decrements the count", async () => {
    const { client, calls } = fakeClient();
    const key = putStatus(makeStatus("1", { reblogged: true, reblogsCount: 3 }), "mock.instance");
    await toggleStatusAction(ctx(client), key, "boost");
    expect(calls).toEqual(["unboost:1"]);
    expect(store.statuses[key]?.reblogged).toBe(false);
    expect(store.statuses[key]?.reblogsCount).toBe(2);
  });

  it("bumps the boosts revision only after a successful boost", async () => {
    const failing = fakeClient({ failOn: "boost:" });
    const key = putStatus(makeStatus("1"), "mock.instance");
    await toggleStatusAction(ctx(failing.client), key, "boost");
    expect(store.ui.boostsRevision).toBe(0);

    await toggleStatusAction(ctx(fakeClient().client), key, "boost");
    expect(store.ui.boostsRevision).toBe(1);
  });

  it("saves the server response after a boost", async () => {
    const inner = makeStatus("1", { reblogged: true, reblogsCount: 1 });
    const wrapper = makeStatus("W1", {
      uri: "https://mock.instance/users/u/statuses/W1",
      reblog: inner,
    });
    const client = {
      v1: {
        statuses: { $select: () => ({ reblog: async () => wrapper }) },
      },
      v2: {
        search: { list: async () => ({ accounts: [], hashtags: [], statuses: [] }) },
      },
    } as unknown as RestClient;
    const key = putStatus(makeStatus("1"), "mock.instance");
    await toggleStatusAction(ctx(client), key, "boost");
    // The wrapper and its inner (same key) come from the server response.
    expect(store.statuses[statusKey(wrapper)]?.reblog).toBeTruthy();
    expect(store.statuses[key]?.reblogged).toBe(true);
  });

  it("resolves the local id before acting on a status from another instance", async () => {
    const { client, calls } = fakeClient({ remote: true });
    const key = putStatus(
      makeStatus("77", { uri: "https://remote.example/users/u/statuses/77" }),
      "other.instance",
    );
    await toggleStatusAction(ctx(client), key, "boost");
    expect(calls).toEqual(["boost:L9"]);
    // Resolving replaced the cache entry with the server copy (same uri);
    // the optimistic patch must survive it.
    expect(store.statuses[key]?.reblogged).toBe(true);
    expect(store.statuses[key]?.reblogsCount).toBe(1);
  });
});

describe("deleteStatus", () => {
  it("deletes the local status and drops it from the cache", async () => {
    const { client, calls } = fakeClient();
    const key = putStatus(makeStatus("1"), "mock.instance");
    const ok = await deleteStatus(ctx(client), key);
    expect(ok).toBe(true);
    expect(calls).toEqual(["delete:1"]);
    expect(store.statuses[key]).toBeUndefined();
    expect(store.statusSources[key]).toBeUndefined();
    expect(lastToast()?.kind).toBe("ok");
  });

  it("keeps the status cached when the API fails", async () => {
    const { client } = fakeClient({ failOn: "delete:" });
    const key = putStatus(makeStatus("1"), "mock.instance");
    const ok = await deleteStatus(ctx(client), key);
    expect(ok).toBe(false);
    expect(store.statuses[key]).toBeTruthy();
    expect(lastToast()?.kind).toBe("error");
  });

  it("resolves the local copy first and removes every cached copy by uri", async () => {
    const { client, calls } = fakeClient({ remote: true });
    const key = putStatus(
      makeStatus("77", { uri: "https://remote.example/users/u/statuses/77" }),
      "other.instance",
    );
    const ok = await deleteStatus(ctx(client), key);
    expect(ok).toBe(true);
    expect(calls).toEqual(["delete:L9"]);
    expect(store.statuses[key]).toBeUndefined();
    expect(lastToast()?.kind).toBe("ok");
  });
});

describe("blockStatusAuthor", () => {
  it("blocks and records the hiding invariant", async () => {
    const { client, calls } = fakeClient();
    const key = putStatus(makeStatus("1"), "mock.instance");
    const ok = await blockStatusAuthor(ctx(client), key);
    expect(ok).toBe(true);
    expect(calls).toEqual(["block:a2"]);
    expect(store.blockedAccounts).toContain("u@remote.example");
    expect(lastToast()?.kind).toBe("ok");
  });

  it("records nothing when blocking fails", async () => {
    const { client } = fakeClient({ failOn: "block:" });
    const key = putStatus(makeStatus("1"), "mock.instance");
    const ok = await blockStatusAuthor(ctx(client), key);
    expect(ok).toBe(false);
    expect(store.blockedAccounts).toHaveLength(0);
    expect(lastToast()?.kind).toBe("error");
  });
});

describe("reportStatus", () => {
  it("denuncia o status resolvido localmente", async () => {
    const { client, calls } = fakeClient({ remote: true });
    const key = putStatus(
      makeStatus("77", { uri: "https://remote.example/users/u/statuses/77" }),
      "other.instance",
    );
    const ok = await reportStatus(ctx(client), key, { comment: "  spam  " });
    expect(ok).toBe(true);
    expect(calls).toEqual(["report"]);
    expect(lastToast()?.kind).toBe("ok");
  });

  it("sends category, rule ids and forward when given", async () => {
    const { client, reportParams } = fakeClient({ remote: true });
    const key = putStatus(
      makeStatus("77", { uri: "https://remote.example/users/u/statuses/77" }),
      "other.instance",
    );
    const ok = await reportStatus(ctx(client), key, {
      category: "violation",
      ruleIds: ["1", ""],
      forward: true,
      comment: " rules ",
    });
    expect(ok).toBe(true);
    expect(reportParams()).toMatchObject({
      category: "violation",
      ruleIds: ["1"],
      forward: true,
      comment: "rules",
    });
  });

  it("can mute and block together with the report", async () => {
    const { client, calls } = fakeClient({ remote: true });
    const key = putStatus(
      makeStatus("77", { uri: "https://remote.example/users/u/statuses/77" }),
      "other.instance",
    );
    expect(await reportStatus(ctx(client), key, { also: "mute" })).toBe(true);
    expect(calls).toEqual(["report", "mute:a-local"]);
    expect(await reportStatus(ctx(client), key, { also: "block" })).toBe(true);
    expect(calls).toEqual(["report", "mute:a-local", "report", "block:a-local"]);
    expect(store.blockedAccounts).toContain("u@remote.example");
  });

  it("fails without available resolvers", async () => {
    const { client } = fakeClient();
    const key = putStatus(
      makeStatus("77", { uri: "https://remote.example/users/u/statuses/77" }),
      "other.instance",
    );
    const ok = await reportStatus(ctx(client), key, {});
    expect(ok).toBe(false);
    expect(lastToast()?.kind).toBe("error");
  });
});

describe("votePoll", () => {
  const polled = (over: Partial<Poll> = {}): Status =>
    makeStatus("1", {
      poll: {
        id: "p1",
        multiple: false,
        voted: false,
        expired: false,
        options: [],
        ...over,
      } as unknown as Poll,
    });

  it("votes and updates the poll with the server response", async () => {
    const { client, calls } = fakeClient();
    const key = putStatus(polled(), "mock.instance");
    const ok = await votePoll(ctx(client), key, 0);
    expect(ok).toBe(true);
    expect(calls).toEqual(["vote:p1"]);
    expect(store.statuses[key]?.poll?.voted).toBe(true);
  });

  it("does not vote again on a single-choice poll", async () => {
    const { client, calls } = fakeClient();
    const key = putStatus(polled({ voted: true }), "mock.instance");
    const ok = await votePoll(ctx(client), key, 0);
    expect(ok).toBe(false);
    expect(calls).toHaveLength(0);
  });
});
