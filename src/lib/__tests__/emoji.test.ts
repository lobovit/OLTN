import { describe, expect, it } from "vitest";
import { searchEmojis, type EmojiGroup } from "../emoji";

const groups: EmojiGroup[] = [
  {
    id: 0,
    label: "Sorrisos",
    emojis: [
      { c: "😀", l: "rosto risonho", t: ["feliz", "risada"] },
      { c: "😢", l: "rosto chorando", t: ["triste"] },
      { c: "👋", l: "mão acenando", t: ["oi", "tchau"], s: ["👋🏻", "👋🏼", "👋🏽", "👋🏾", "👋🏿"] },
    ],
  },
];

describe("searchEmojis", () => {
  it("searches by label, tag and accent-less text", () => {
    expect(searchEmojis(groups, "risada").map((e) => e.c)).toEqual(["😀"]);
    expect(searchEmojis(groups, "mao").map((e) => e.c)).toEqual(["👋"]);
  });

  it("searches by the character itself", () => {
    expect(searchEmojis(groups, "😢").map((e) => e.c)).toEqual(["😢"]);
  });

  it("respects the result limit", () => {
    const results = searchEmojis(groups, "o", 1);
    expect(results).toHaveLength(1);
  });

  it("returns empty for an empty search", () => {
    expect(searchEmojis(groups, "  ")).toEqual([]);
  });
});
