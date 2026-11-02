import { describe, expect, it } from "vitest";
import type { NewsletterSource, Status } from "../../api/types";
import {
  addDefaultNewsletterSources,
  DEFAULT_NEWSLETTER_SOURCES,
  mergeResolvedSources,
  NEWSLETTER_DEFAULTS_VERSION,
  newestFirst,
} from "../newsletter";

function status(id: string, createdAt: string): Status {
  return {
    id,
    uri: `https://mock.example/users/u/statuses/${id}`,
    createdAt,
  } as unknown as Status;
}

describe("default newsletter sources", () => {
  it("ships the requested profiles without duplicates", () => {
    expect(DEFAULT_NEWSLETTER_SOURCES.map((source) => source.acct)).toEqual([
      "icnoticias.com.br@rss-parrot.net",
      "jornalpublicobot@mastodon.world",
      "FlipboardBR@flipboard.com",
      "teiadospovos@kolektiva.social",
      "noticiasbrasil@mastodon.social",
    ]);
  });

  it("adds the new defaults to a list seeded with the old set", () => {
    const seeded = DEFAULT_NEWSLETTER_SOURCES.slice(0, 3).map((source) => ({
      ...source,
      id: source.name,
    }));
    const next = addDefaultNewsletterSources(seeded, undefined);
    expect(next.map((source) => source.acct)).toEqual(
      DEFAULT_NEWSLETTER_SOURCES.map((source) => source.acct),
    );
    expect(next.slice(0, 3)).toEqual(seeded);
  });

  it("does not duplicate defaults already present", () => {
    const seeded = DEFAULT_NEWSLETTER_SOURCES.map((source) => ({
      ...source,
      id: source.name.toLowerCase(),
    }));
    expect(addDefaultNewsletterSources(seeded, undefined)).toEqual(seeded);
  });

  it("leaves custom-only and emptied lists alone", () => {
    const custom: NewsletterSource[] = [{ id: "1", acct: "ana@remote.example", name: "Ana" }];
    expect(addDefaultNewsletterSources(custom, undefined)).toEqual(custom);
    expect(addDefaultNewsletterSources([], undefined)).toEqual([]);
  });

  it("does not re-add defaults after a removed source on a current version", () => {
    const remaining = DEFAULT_NEWSLETTER_SOURCES.slice(0, 1);
    expect(addDefaultNewsletterSources(remaining, NEWSLETTER_DEFAULTS_VERSION)).toEqual(remaining);
  });

  it("fills the local ids of unresolved sources", () => {
    const current: NewsletterSource[] = [
      { id: "", acct: "ana@remote.example", name: "ana" },
      { id: "2", acct: "local", name: "Local" },
    ];
    const resolved: NewsletterSource[] = [
      { id: "1", acct: "ana@remote.example", name: "Ana" },
      { id: "3", acct: "removed@remote.example", name: "Removed" },
    ];
    expect(mergeResolvedSources(current, resolved)).toEqual([
      { id: "1", acct: "ana@remote.example", name: "Ana" },
      { id: "2", acct: "local", name: "Local" },
    ]);
  });

  it("does not resurrect a removed default", () => {
    const resolved: NewsletterSource[] = [{ id: "1", acct: "ana@remote.example", name: "Ana" }];
    expect(mergeResolvedSources([], resolved)).toEqual([]);
  });
});

describe("newestFirst", () => {
  it("merges lists ordered by date, newest first", () => {
    const result = newestFirst([
      [status("1", "2026-01-01T10:00:00Z"), status("3", "2026-01-01T12:00:00Z")],
      [status("2", "2026-01-01T11:00:00Z")],
    ]);
    expect(result.map((item) => item.id)).toEqual(["3", "2", "1"]);
  });

  it("drops duplicated statuses across lists", () => {
    const same = status("1", "2026-01-01T10:00:00Z");
    expect(newestFirst([[same], [{ ...same }]])).toHaveLength(1);
  });

  it("caps the merged list", () => {
    const list = [status("1", "2026-01-01T10:00:00Z"), status("2", "2026-01-01T11:00:00Z")];
    expect(newestFirst([list], 1).map((item) => item.id)).toEqual(["2"]);
  });
});
