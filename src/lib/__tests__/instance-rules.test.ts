import { describe, expect, it } from "vitest";
import { ruleText, type InstanceRule } from "../instance-rules";

function rule(overrides: Partial<InstanceRule> = {}): InstanceRule {
  return { id: "1", text: "Be nice", translations: {}, ...overrides };
}

describe("ruleText", () => {
  it("prefers the exact language translation", () => {
    const translated = rule({
      translations: { "pt-BR": "Seja gentil", en: "Be nice" },
    });
    expect(ruleText(translated, "pt-BR")).toBe("Seja gentil");
  });

  it("matches region variants for the base language", () => {
    const translated = rule({ translations: { "pt-PT": "Sê gentil" } });
    expect(ruleText(translated, "pt-BR")).toBe("Sê gentil");
  });

  it("falls back to the original text without a match", () => {
    expect(ruleText(rule({ translations: { fr: "Sois gentil" } }), "en")).toBe("Be nice");
    expect(ruleText(rule(), "pt-BR")).toBe("Be nice");
  });
});
