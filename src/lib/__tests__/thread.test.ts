import { describe, expect, it } from "vitest";
import { splitThreadText } from "../thread";

describe("splitThreadText", () => {
  it("texto curto devolve uma única parte", () => {
    expect(splitThreadText("oi mundo", 500)).toEqual(["oi mundo"]);
  });

  it("divide em parágrafos quando possível", () => {
    const text = "a".repeat(60) + "\n\n" + "b".repeat(60);
    const parts = splitThreadText(text, 80);
    expect(parts).toEqual(["a".repeat(60), "b".repeat(60)]);
  });

  it("divide em frases quando não há parágrafos", () => {
    const text = "Primeira frase longa. ".repeat(5).trim();
    const parts = splitThreadText(text, 50);
    expect(parts.length).toBeGreaterThan(1);
    for (const part of parts) expect(part.length).toBeLessThanOrEqual(50);
    expect(partesEndWithSentence(parts)).toBe(true);
  });

  it("nunca perde conteúdo e respeita o limite", () => {
    const text = (
      "palavra ".repeat(20) +
      "\n\n" +
      "outra frase bem maior com pontuação. " +
      "x".repeat(600)
    ).trim();
    const parts = splitThreadText(text, 100);
    for (const part of parts) expect(part.length).toBeLessThanOrEqual(100);
    const strip = (s: string): string => s.replace(/\s+/g, "");
    expect(strip(parts.join(""))).toBe(strip(text));
  });

  it("faz corte duro quando não há separadores", () => {
    const parts = splitThreadText("x".repeat(250), 100);
    expect(parts).toEqual(["x".repeat(100), "x".repeat(100), "x".repeat(50)]);
  });
});

function partesEndWithSentence(parts: string[]): boolean {
  return parts.slice(0, -1).every((part) => /[.!?]$/.test(part));
}
