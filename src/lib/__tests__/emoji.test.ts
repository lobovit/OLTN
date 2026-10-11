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
  it("busca por rótulo, tag e sem acento", () => {
    expect(searchEmojis(groups, "risada").map((e) => e.c)).toEqual(["😀"]);
    expect(searchEmojis(groups, "mao").map((e) => e.c)).toEqual(["👋"]);
  });

  it("busca pelo próprio caractere", () => {
    expect(searchEmojis(groups, "😢").map((e) => e.c)).toEqual(["😢"]);
  });

  it("respeita o limite de resultados", () => {
    const results = searchEmojis(groups, "o", 1);
    expect(results).toHaveLength(1);
  });

  it("devolve vazio para busca vazia", () => {
    expect(searchEmojis(groups, "  ")).toEqual([]);
  });
});
