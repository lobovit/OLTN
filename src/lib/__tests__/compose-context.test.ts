import { describe, expect, it } from "vitest";
import type { Status } from "../../api/types";
import {
  applyComposeContext,
  type ComposeContextSetters,
} from "../../components/compose/compose-context";

function accountStatus(acct: string, username: string): Status {
  return { id: "1", account: { acct, username } } as unknown as Status;
}

function setters() {
  const calls = {
    replyTo: null as { id: string; acct: string } | null,
    text: "",
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
    setVisibility: () => {},
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
});
