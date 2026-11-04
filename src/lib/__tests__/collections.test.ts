import { describe, expect, it } from "vitest";
import type { Account, Collection, CollectionWithAccounts } from "../../api/types";
import {
  buildCollectionPayload,
  canAddToCollection,
  canCreateCollection,
  collectionAccountHandle,
  collectionAccountPolicy,
  collectionEntries,
  collectionOwner,
  collectionPreviewAccountIds,
  collectionShareLink,
  normalizeCollectionTag,
} from "../collections";

const account = (id: string, acct: string): Account => ({
  id,
  acct,
  username: acct.split("@")[0],
  displayName: "",
  url: `https://example.test/@${acct.split("@")[0]}`,
  note: "",
  avatar: "",
  avatarStatic: "",
  header: "",
  headerStatic: "",
  locked: false,
  bot: false,
  group: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  lastStatusAt: "2026-01-01T00:00:00.000Z",
  statusesCount: 0,
  followersCount: 0,
  followingCount: 0,
  fields: [],
  emojis: [],
  roles: [],
  featureApproval: { automatic: [], manual: [], current_user: "unknown" },
});

const item = (id: string, accountId?: string, state: "pending" | "accepted" = "accepted") => ({
  id,
  accountId,
  state,
  createdAt: "2026-01-01T00:00:00.000Z",
});

const collection = (overrides: Partial<Collection> = {}): Collection =>
  ({
    id: "1",
    uri: "https://example.test/collections/1",
    url: "https://example.test/collections/1",
    accountId: "owner",
    local: true,
    itemCount: 2,
    name: "News",
    description: "A collection",
    tag: null,
    language: "en",
    sensitive: false,
    discoverable: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    items: [],
    ...overrides,
  }) as Collection;

describe("collection helpers", () => {
  it("builds full handles for local and remote accounts", () => {
    expect(collectionAccountHandle({ acct: "alice" }, "example.test")).toBe("alice@example.test");
    expect(collectionAccountHandle({ acct: "@alice@remote.test" }, "example.test")).toBe(
      "alice@remote.test",
    );
  });

  it("previews featured items only, without duplicates", () => {
    const value = collection({
      accountId: "owner",
      items: [item("i1", "a"), item("i2", "b"), item("i3", "c"), item("i4", "d")],
    });
    expect(collectionPreviewAccountIds(value)).toEqual(["a", "b", "c", "d"]);
    expect(
      collectionPreviewAccountIds(collection({ items: [item("i1", "a"), item("i2", "a")] })),
    ).toEqual(["a"]);
    expect(collectionPreviewAccountIds(collection({ items: [item("i1")] }))).toEqual([]);
  });

  it("maps items to accounts and finds the owner", () => {
    const data = {
      collection: collection({ accountId: "owner", items: [item("i1", "a"), item("i2")] }),
      accounts: [account("owner", "owner"), account("a", "alice")],
    } as unknown as CollectionWithAccounts;
    expect(collectionEntries(data).map((entry) => entry.account.id)).toEqual(["a"]);
    expect(collectionOwner(data)?.id).toBe("owner");
    expect(collectionOwner({ ...data, accounts: [] })).toBeNull();
  });

  it("prefers the canonical URL for sharing", () => {
    expect(collectionShareLink(collection(), "fallback")).toBe(
      "https://example.test/collections/1",
    );
    expect(collectionShareLink(collection({ url: null }), "fallback")).toBe("fallback");
  });
});

describe("collection editor helpers", () => {
  it("normalizes hashtags and empty fields", () => {
    expect(normalizeCollectionTag("  ##Fediverso  ")).toBe("Fediverso");
    expect(normalizeCollectionTag("   ")).toBe("");
    expect(
      buildCollectionPayload({
        name: "  News  ",
        description: "  ",
        tag: " #noticias ",
        language: "",
        discoverable: false,
        sensitive: true,
      }),
    ).toEqual({
      name: "News",
      description: null,
      language: null,
      tagName: "noticias",
      discoverable: false,
      sensitive: true,
    });
  });

  it("checks the role collection quota", () => {
    expect(canCreateCollection(0, 0)).toBe(false);
    expect(canCreateCollection(3, 2)).toBe(true);
    expect(canCreateCollection(3, 3)).toBe(false);
  });
});

describe("collection feature approval", () => {
  const withApproval = (approval: unknown): Account =>
    ({
      ...account("20", "alice"),
      featureApproval: approval,
    }) as unknown as Account;

  it("reads the camel-cased policy returned by masto", () => {
    expect(
      collectionAccountPolicy(
        withApproval({ automatic: ["public"], manual: [], currentUser: "manual" }),
      ),
    ).toBe("manual");
    expect(
      collectionAccountPolicy(
        withApproval({ automatic: ["public"], manual: [], currentUser: "denied" }),
      ),
    ).toBe("denied");
  });

  it("allows automatic and manual approval only", () => {
    expect(
      canAddToCollection(
        withApproval({ automatic: ["public"], manual: [], current_user: "automatic" }),
      ),
    ).toBe(true);
    expect(
      canAddToCollection(
        withApproval({ automatic: [], manual: ["public"], current_user: "manual" }),
      ),
    ).toBe(true);
    expect(
      canAddToCollection(withApproval({ automatic: [], manual: [], current_user: "denied" })),
    ).toBe(false);
    expect(canAddToCollection(withApproval(undefined))).toBe(false);
  });
});
