import { beforeEach, describe, expect, it } from "vitest";
import type { Account, RestClient, Status } from "../../api/types";
import {
  clientFor,
  hrefFor,
  isOwnInstance,
  localAccountId,
  localStatus,
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
