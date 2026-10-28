import { describe, expect, it } from "vitest";
import type { ComposeVisibility, Status } from "../../api/types";
import {
  applyComposeContext,
  defaultComposeVisibility,
  replyVisibility,
  type ComposeContextSetters,
} from "../../components/compose/compose-context";

function accountStatus(
  acct: string,
  username: string,
  visibility: Status["visibility"] = "public",
): Status {
  return { id: "1", account: { acct, username }, visibility } as unknown as Status;
}

function setters() {
  const calls = {
    replyTo: null as { id: string; acct: string } | null,
    text: "",
    visibility: "public" as ComposeVisibility,
  };
  const set: ComposeContextSetters = {
    setReplyTo: (value) => {
      calls.replyTo = typeof value === "function" ? value(calls.replyTo) : value;
    },
    setQuoteId: () => {},
    setText: (value) => {
      calls.text = typeof value === "function" ? value(calls.text) : value;
    },
    setSpoiler: () => {},
    setShowCw: () => {},
    setVisibility: (value) => {
      calls.visibility = typeof value === "function" ? value(calls.visibility) : value;
    },
    setSensitive: () => {},
    setMedia: () => {},
    setPoll: () => {},
    setQuotePolicy: () => {},
  };
  return { calls, set };
}

describe("applyComposeContext reply", () => {
  it("mentions remote accounts with their full acct", () => {
    const { calls, set } = setters();
    applyComposeContext(
      accountStatus("Luanaaaa@colorid.es", "Luanaaaa"),
      "reply",
      "my.instance",
      set,
    );
    expect(calls.replyTo).toEqual({ id: "1", acct: "Luanaaaa@colorid.es" });
    expect(calls.text).toBe("@Luanaaaa@colorid.es ");
  });

  it("mentions local accounts by username and keeps the pill acct complete", () => {
    const { calls, set } = setters();
    applyComposeContext(accountStatus("me", "me"), "reply", "my.instance", set);
    expect(calls.replyTo).toEqual({ id: "1", acct: "me@my.instance" });
    expect(calls.text).toBe("@me ");
  });

  it("keeps text the user already typed", () => {
    const { calls, set } = setters();
    calls.text = "draft";
    applyComposeContext(accountStatus("u@remote.example", "u"), "reply", "my.instance", set);
    expect(calls.text).toBe("draft");
  });

  it("keeps a direct reply direct", () => {
    const { calls, set } = setters();
    applyComposeContext(
      accountStatus("u@remote.example", "u", "direct"),
      "reply",
      "my.instance",
      set,
    );
    expect(calls.visibility).toBe("direct");
  });

  it("does not widen followers-only and unlisted replies", () => {
    const followers = setters();
    applyComposeContext(
      accountStatus("u@remote.example", "u", "private"),
      "reply",
      "my.instance",
      followers.set,
    );
    expect(followers.calls.visibility).toBe("private");

    const unlisted = setters();
    applyComposeContext(
      accountStatus("u@remote.example", "u", "unlisted"),
      "reply",
      "my.instance",
      unlisted.set,
    );
    expect(unlisted.calls.visibility).toBe("unlisted");
  });

  it("uses the more restrictive of parent and default privacy", () => {
    const { calls, set } = setters();
    applyComposeContext(
      accountStatus("u@remote.example", "u", "public"),
      "reply",
      "my.instance",
      set,
      { defaultVisibility: "private" },
    );
    expect(calls.visibility).toBe("private");
  });
});

describe("replyVisibility", () => {
  it("never makes a reply more public than its parent", () => {
    expect(replyVisibility("direct")).toBe("direct");
    expect(replyVisibility("private")).toBe("private");
    expect(replyVisibility("unlisted")).toBe("unlisted");
    expect(replyVisibility("public")).toBe("public");
    expect(replyVisibility(undefined)).toBe("public");
  });

  it("respects a more restrictive account default", () => {
    expect(replyVisibility("public", "private")).toBe("private");
    expect(replyVisibility("unlisted", "direct")).toBe("direct");
  });
});

describe("defaultComposeVisibility", () => {
  it("normalizes Mastodon's source privacy", () => {
    expect(defaultComposeVisibility("private")).toBe("private");
    expect(defaultComposeVisibility("direct")).toBe("direct");
    expect(defaultComposeVisibility("unlisted")).toBe("unlisted");
    expect(defaultComposeVisibility("local")).toBe("public");
    expect(defaultComposeVisibility(null)).toBe("public");
  });
});
