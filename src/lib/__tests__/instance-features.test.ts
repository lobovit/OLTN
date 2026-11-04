import { describe, expect, it } from "vitest";
import {
  COLLECTIONS_MIN_API_VERSION,
  parseMastodonVersion,
  supportsCollections,
} from "../instance-features";

describe("instance feature detection", () => {
  it("parses Mastodon release strings", () => {
    expect(parseMastodonVersion("4.6.0")).toEqual({ major: 4, minor: 6, patch: 0 });
    expect(parseMastodonVersion("4.7.5+glitch")).toEqual({ major: 4, minor: 7, patch: 5 });
    expect(parseMastodonVersion("Pleroma 2.5.0")).toBeNull();
    expect(parseMastodonVersion(null)).toBeNull();
  });

  it("prefers the REST API version", () => {
    expect(supportsCollections({ apiVersion: COLLECTIONS_MIN_API_VERSION, version: "4.5.0" })).toBe(
      true,
    );
    expect(supportsCollections({ apiVersion: 9, version: "4.7.0" })).toBe(false);
  });

  it("falls back to the release version for older servers", () => {
    expect(supportsCollections({ version: "4.6.0" })).toBe(true);
    expect(supportsCollections({ version: "4.6.0+glitch" })).toBe(true);
    expect(supportsCollections({ version: "4.5.9" })).toBe(false);
    expect(supportsCollections({ version: "5.0.0-alpha.3" })).toBe(true);
    expect(supportsCollections({ version: "unknown" })).toBe(false);
    expect(supportsCollections(null)).toBe(false);
  });
});
