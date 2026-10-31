import { beforeEach, describe, expect, it } from "vitest";
import type { Account, RestClient, Status } from "../../api/types";
import {
  clientFor,
  hrefFor,
  isOwnInstance,
  localAccountId,
  localStatus,
  mentionHandleFor,
  resolveAccountHandle,
  searchAccountsByUsername,
  sourceInstanceFor,
  tokenFor,
} from "../identity";
import { store } from "../../state/store";

function status(id: string, uri: string, url?: string): Status {
  return { id, uri, url: url ?? uri } as unknown as Status;
}

const account = (id: string, acct: string): Pick<Account, "id" | "acct"> => ({ id, acct });

function fakeSearch(result: unknown, fail = false) {
  return {
    v2: {
      search: {
        list: async () => {
          if (fail) throw new Error("search failed");
          return result;
        },
      },
    },
  } as unknown as RestClient;
}

beforeEach(() => {
  store.accounts = [
    {
      id: "me",
      instance: "my.instance",
      handle: "@me@my.instance",
      displayName: "Me",
      avatar: "",
      accessToken: "tok",
      clientId: "client",
      createdAt: 0,
    },
  ];
  store.currentAccountId = "me";
  store.statusSources = {};
  store.statuses = {};
  store.instance = null;
});

describe("token and client scoping", () => {
  it("attaches the token only on the account instance", () => {
    expect(tokenFor("my.instance")).toBe("tok");
    expect(tokenFor("other.instance")).toBeUndefined();
    expect(clientFor("my.instance").authed).toBe(true);
    expect(clientFor("other.instance").authed).toBe(false);
    expect(clientFor("my.instance").instance).toBe("my.instance");
  });

  it("reports whether an instance belongs to the account", () => {
    expect(isOwnInstance("my.instance")).toBe(true);
    expect(isOwnInstance("other.instance")).toBe(false);
    expect(isOwnInstance(undefined)).toBe(false);
  });
});

describe("hrefFor", () => {
  it("accountById points at the instance that owns the id", () => {
    expect(hrefFor.accountById("my.instance", "2")).toBe("/my.instance/a/2");
  });
  it("builds status, account and tag routes", () => {
    expect(hrefFor.status("123", "remote.example")).toBe("/remote.example/s/123");
    expect(hrefFor.account("user@remote.example", "fallback")).toBe("/remote.example/a/@user");
    expect(hrefFor.account("user", "fallback")).toBe("/fallback/a/@user");
    expect(hrefFor.tag("ola mundo", "my.instance")).toBe("/my.instance/t/ola%20mundo");
  });

  it("converts external Mastodon paths, including legacy shapes", () => {
    expect(hrefFor.fromExternalUrl("h.example", "/@user/123")).toBe("/h.example/s/123");
    expect(hrefFor.fromExternalUrl("h.example", "/users/user/statuses/123/")).toBe(
      "/h.example/s/123",
    );
    expect(hrefFor.fromExternalUrl("h.example", "/@user")).toBe("/h.example/a/@user");
    expect(hrefFor.fromExternalUrl("h.example", "/users/user")).toBe("/h.example/a/@user");
    expect(hrefFor.fromExternalUrl("h.example", "/tags/foo")).toBe("/h.example/t/foo");
    expect(hrefFor.fromExternalUrl("h.example", "/tag/foo")).toBe("/h.example/t/foo");
    expect(hrefFor.fromExternalUrl("h.example", "/about")).toBeNull();
  });
});

describe("sourceInstanceFor", () => {
  it("prefers the recorded source over the author host", () => {
    store.statusSources["https://remote.example/users/a/statuses/1"] = "my.instance";
    const remote = status("1", "https://remote.example/users/a/statuses/1");
    expect(sourceInstanceFor("https://remote.example/users/a/statuses/1", remote)).toBe(
      "my.instance",
    );
  });

  it("falls back to the uri host, then the current instance", () => {
    const remote = status("1", "https://remote.example/users/a/statuses/1");
    expect(sourceInstanceFor("missing", remote)).toBe("remote.example");
    store.instance = { uri: "my.instance" } as never;
    expect(sourceInstanceFor("missing", status("2", "not a url"))).toBe("my.instance");
  });
});

describe("mentionHandleFor", () => {
  it("keeps a local account bare on the same instance", () => {
    expect(mentionHandleFor({ acct: "alice" }, "my.instance", "my.instance")).toBe("alice");
  });

  it("adds the profile domain for a local account viewed on another instance", () => {
    expect(mentionHandleFor({ acct: "alice" }, "remote.example", "my.instance")).toBe(
      "alice@remote.example",
    );
  });

  it("keeps the full acct of a remote account", () => {
    expect(mentionHandleFor({ acct: "alice@remote.example" }, "my.instance", "my.instance")).toBe(
      "alice@remote.example",
    );
  });
});

describe("resolveAccountHandle", () => {
  const withSearch = (accounts: unknown[], fail = false) => {
    const calls: string[] = [];
    const client = {
      v2: {
        search: {
          list: async (params: { q: string }) => {
            calls.push(params.q);
            if (fail) throw new Error("search failed");
            return { accounts, hashtags: [], statuses: [] };
          },
        },
      },
    } as unknown as RestClient;
    return { client, calls };
  };

  it("resolves the requested handle, ignoring the leading @ and case", async () => {
    const { client, calls } = withSearch([
      { id: "1", acct: "other@remote.example" },
      { id: "7", acct: "newsbot@remote.example" },
    ]);
    const found = await resolveAccountHandle(client, " @NewsBot@Remote.Example ");
    expect(found?.id).toBe("7");
    expect(calls).toEqual(["newsbot@remote.example"]);
  });

  it("resolves a full handle for an account local to the instance", async () => {
    const { client } = withSearch([
      {
        id: "7",
        username: "newsbot",
        acct: "newsbot",
        url: "https://my.example/@newsbot",
      },
    ]);
    const found = await resolveAccountHandle(client, "@newsbot@my.example");
    expect(found?.id).toBe("7");
  });

  it("rejects a local username from a different domain", async () => {
    const { client } = withSearch([
      {
        id: "7",
        username: "newsbot",
        acct: "newsbot",
        url: "https://other.example/@newsbot",
      },
    ]);
    expect(await resolveAccountHandle(client, "@newsbot@my.example")).toBeNull();
  });

  it("rejects fuzzy results that are not the requested handle", async () => {
    const { client } = withSearch([{ id: "1", acct: "other@remote.example" }]);
    expect(await resolveAccountHandle(client, "newsbot@remote.example")).toBeNull();
  });

  it("does not search without a full handle", async () => {
    const { client, calls } = withSearch([]);
    expect(await resolveAccountHandle(client, "newsbot")).toBeNull();
    expect(calls).toEqual([]);
  });

  it("returns null when the search fails", async () => {
    const { client } = withSearch([], true);
    expect(await resolveAccountHandle(client, "newsbot@remote.example")).toBeNull();
  });
});

describe("searchAccountsByUsername", () => {
  const withSearch = (accounts: unknown[], fail = false) => {
    const calls: string[] = [];
    const client = {
      v2: {
        search: {
          list: async (params: { q: string }) => {
            calls.push(params.q);
            if (fail) throw new Error("search failed");
            return { accounts, hashtags: [], statuses: [] };
          },
        },
      },
    } as unknown as RestClient;
    return { client, calls };
  };

  it("keeps only accounts whose username matches the bare handle", async () => {
    const { client, calls } = withSearch([
      { id: "1", username: "other", acct: "other@remote.example" },
      { id: "7", username: "NewsBot", acct: "NewsBot@remote.example" },
    ]);
    const matches = await searchAccountsByUsername(client, " @newsbot ");
    expect(matches.map((account) => account.id)).toEqual(["7"]);
    expect(calls).toEqual(["newsbot"]);
  });

  it("matches partial usernames when requested", async () => {
    const { client } = withSearch([
      { id: "1", username: "other", acct: "other@remote.example" },
      { id: "2", username: "perfil", acct: "perfil@remote.example" },
      { id: "3", username: "perfilnews", acct: "perfilnews@remote.example" },
    ]);
    const matches = await searchAccountsByUsername(client, "@perfil", { partial: true });
    expect(matches.map((account) => account.id)).toEqual(["2", "3"]);
  });

  it("does not search full handles (they resolve exactly)", async () => {
    const { client, calls } = withSearch([]);
    expect(await searchAccountsByUsername(client, "newsbot@remote.example")).toEqual([]);
    expect(calls).toEqual([]);
  });

  it("caps the matches at five", async () => {
    const { client } = withSearch(
      Array.from({ length: 8 }, (_, index) => ({
        id: String(index),
        username: "newsbot",
        acct: `newsbot@h${index}.example`,
      })),
    );
    expect(await searchAccountsByUsername(client, "newsbot")).toHaveLength(5);
  });

  it("returns an empty list when the search fails", async () => {
    const { client } = withSearch([], true);
    expect(await searchAccountsByUsername(client, "newsbot")).toEqual([]);
  });
});

describe("local resolution", () => {
  it("passes through statuses already on the account instance", async () => {
    const local = status("1", "https://my.instance/users/a/statuses/1");
    const resolved = await localStatus(
      fakeSearch({ statuses: [] }),
      "my.instance",
      local,
      "my.instance",
    );
    expect(resolved).toBe(local);
  });

  it("resolves remote statuses by uri, falling back to the first result", async () => {
    const remote = status("77", "https://remote.example/users/a/statuses/77");
    const local9 = status("L9", "https://remote.example/users/a/statuses/77");
    const match = await localStatus(
      fakeSearch({ statuses: [status("X", "other"), local9] }),
      "my.instance",
      remote,
      "remote.example",
    );
    expect(match?.id).toBe("L9");

    const fallback = await localStatus(
      fakeSearch({ statuses: [status("L9", "unknown-uri")] }),
      "my.instance",
      remote,
      "remote.example",
    );
    expect(fallback?.id).toBe("L9");
  });

  it("returns null when the search fails or finds nothing", async () => {
    const remote = status("77", "https://remote.example/users/a/statuses/77");
    expect(
      await localStatus(fakeSearch(null, true), "my.instance", remote, "remote.example"),
    ).toBeNull();
    expect(
      await localStatus(fakeSearch({ statuses: [] }), "my.instance", remote, "remote.example"),
    ).toBeNull();
  });

  it("resolves account ids, passing through on the account instance", async () => {
    const search = fakeSearch({ accounts: [{ id: "a-local" }] });
    expect(await localAccountId(search, "my.instance", account("a1", "u"), "my.instance")).toBe(
      "a1",
    );
    expect(
      await localAccountId(
        search,
        "my.instance",
        account("a1", "u@remote.example"),
        "remote.example",
      ),
    ).toBe("a-local");
    expect(
      await localAccountId(
        fakeSearch(null, true),
        "my.instance",
        account("a1", "u"),
        "remote.example",
      ),
    ).toBeNull();
  });
});
