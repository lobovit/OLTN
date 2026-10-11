import { describe, expect, it } from "vitest";
import {
  extractMention,
  formatDuration,
  htmlToPlainText,
  normalizeInstance,
  plainTextToHtml,
  timeAgo,
  toLocalInputValue,
} from "../format";

describe("normalizeInstance", () => {
  it("aceita hostname simples", () => {
    expect(normalizeInstance("mastodon.social")).toBe("mastodon.social");
  });

  it("remove https:// e caminho", () => {
    expect(normalizeInstance("https://mastodon.social/")).toBe("mastodon.social");
    expect(normalizeInstance("https://mastodon.social/about")).toBe("mastodon.social");
  });

  it("extrai host de menção", () => {
    expect(normalizeInstance("@user@mastodon.social")).toBe("mastodon.social");
  });
});

describe("extractMention", () => {
  it("extrai user e host", () => {
    expect(extractMention("@user@mastodon.social")).toEqual({
      username: "user",
      host: "mastodon.social",
    });
  });
});

describe("timeAgo", () => {
  it("formata minutos e horas", () => {
    const now = Date.now();
    expect(timeAgo(new Date(now - 60_000).toISOString())).toContain("min");
    expect(timeAgo(new Date(now - 3_600_000).toISOString())).toContain("h");
  });
});

describe("toLocalInputValue", () => {
  it("formata para datetime-local com zero à esquerda", () => {
    expect(toLocalInputValue(new Date(2026, 0, 5, 9, 7))).toBe("2026-01-05T09:07");
  });
});

describe("formatDuration", () => {
  it("formata mm:ss e h:mm:ss", () => {
    expect(formatDuration(25 * 60_000)).toBe("25:00");
    expect(formatDuration(65_000)).toBe("01:05");
    expect(formatDuration(3_600_000 + 61_000)).toBe("1:01:01");
    expect(formatDuration(-1000)).toBe("00:00");
  });
});

describe("plainTextToHtml", () => {
  it("converte parágrafos e quebras de linha", () => {
    expect(plainTextToHtml("um\n\n dois\nlinha")).toBe("<p>um</p><p> dois<br>linha</p>");
  });

  it("escapa HTML", () => {
    expect(plainTextToHtml('<b>"x"</b> & y')).toBe(
      "<p>&lt;b&gt;&quot;x&quot;&lt;/b&gt; &amp; y</p>",
    );
  });
});

describe("htmlToPlainText", () => {
  it("quebra parágrafos e <br>", () => {
    expect(htmlToPlainText("<p>Olá<br>mundo</p>")).toBe("Olá\nmundo");
    expect(htmlToPlainText("<p>um</p><p>dois</p>")).toBe("um\n\ndois");
  });

  it("preserva links comuns como texto + URL", () => {
    expect(htmlToPlainText('<a href="https://ex.com/x">site</a>')).toBe("site https://ex.com/x");
  });

  it("não repete URL de hashtag e menção", () => {
    expect(htmlToPlainText('<a href="https://h/tags/t">#t</a>')).toBe("#t");
    expect(htmlToPlainText('<a href="https://h/@ana">@ana</a>')).toBe("@ana");
    expect(htmlToPlainText('<a href="https://ex.com/x">https://ex.com/x</a>')).toBe(
      "https://ex.com/x",
    );
  });

  it("decodifica entidades e remove tags", () => {
    expect(htmlToPlainText("<p>a &amp; b &lt;3</p>")).toBe("a & b <3");
    expect(htmlToPlainText("<p><span>nada</span> de novo</p>")).toBe("nada de novo");
  });
});
