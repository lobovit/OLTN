import { describe, expect, it } from "vitest";
import { normalizeInstanceInput } from "../../api/auth";

describe("normalizeInstanceInput", () => {
  it("accepts plain hosts", () => {
    expect(normalizeInstanceInput("mastodon.social")).toEqual({ host: "mastodon.social" });
    expect(normalizeInstanceInput("  Mastodon.Social  ")).toEqual({ host: "mastodon.social" });
  });

  it("strips protocol and paths, including trailing slashes", () => {
    expect(normalizeInstanceInput("https://mastodon.social/")).toEqual({
      host: "mastodon.social",
    });
    expect(normalizeInstanceInput("http://mastodon.social//about")).toEqual({
      host: "mastodon.social",
    });
  });

  it("understands @user@host mentions", () => {
    expect(normalizeInstanceInput("@user@mastodon.social")).toEqual({
      host: "mastodon.social",
      username: "user",
    });
    expect(normalizeInstanceInput("user@mastodon.social")).toEqual({
      host: "mastodon.social",
      username: "user",
    });
  });

  it("keeps ports and rejects invalid input", () => {
    expect(normalizeInstanceInput("localhost:3000")).toEqual({ host: "localhost:3000" });
    expect(normalizeInstanceInput("")).toBeNull();
    expect(normalizeInstanceInput("@@invalido")).toBeNull();
    expect(normalizeInstanceInput("sem-espaco")).toBeNull();
  });
});
