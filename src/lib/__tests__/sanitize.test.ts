import { describe, expect, it } from "vitest";
import { emojifyInPlace, normalizeEmojiUrl, sanitizeContent } from "../sanitize";

describe("normalizeEmojiUrl", () => {
  it("aceita https e protocolo-relativo; rejeita o resto", () => {
    expect(normalizeEmojiUrl("https://x.com/e.png")).toBe("https://x.com/e.png");
    expect(normalizeEmojiUrl("//x.com/e.png")).toBe("https://x.com/e.png");
    expect(normalizeEmojiUrl("http://x.com/e.png")).toBeNull();
    expect(normalizeEmojiUrl("javascript:alert(1)")).toBeNull();
  });
});

describe("sanitizeContent", () => {
  it("preserva imagens de emoji customizado vindas no content", () => {
    const html =
      '<p>Usando <img class="emojione custom-emoji" alt=":freebsd_logo:" src="https://ex.com/emoji/freebsd_logo.png" title=":freebsd_logo:"></p>';
    const out = sanitizeContent(html);
    expect(out).toContain("<img");
    expect(out).toContain("freebsd_logo.png");
    expect(out).toContain("emojione");
  });

  it("remove scripts e javascript:", () => {
    expect(sanitizeContent("<script>alert(1)</script><p>ok</p>")).not.toContain("<script");
    expect(sanitizeContent('<a href="javascript:alert(1)">x</a>')).not.toContain("javascript:");
  });
});

describe("emojifyInPlace", () => {
  it("dá dimensões explícitas e lazy aos emojis marcados", () => {
    const el = document.createElement("div");
    el.innerHTML = sanitizeContent(
      '<p>oi <img class="custom-thing" alt=":freebsd_logo:" src="https://ex.com/emoji/freebsd.png"></p>',
    );
    emojifyInPlace(el, []);
    const img = el.querySelector("img") as HTMLImageElement;
    expect(img.getAttribute("width")).toBe("20");
    expect(img.getAttribute("height")).toBe("20");
    expect(img.getAttribute("loading")).toBe("lazy");
  });

  it("marca imgs de emoji do servidor mesmo com classe desconhecida", () => {
    const el = document.createElement("div");
    el.innerHTML = sanitizeContent(
      '<p>oi <img class="custom-thing" alt=":freebsd_logo:" src="https://ex.com/emoji/freebsd.png"></p>',
    );
    emojifyInPlace(el, []);
    expect(el.querySelector("img")?.classList.contains("emoji")).toBe(true);
  });

  it("marca também por URL conhecida (sem alt)", () => {
    const el = document.createElement("div");
    el.innerHTML = sanitizeContent('<p>oi <img src="https://ex.com/emoji/emacs.png"></p>');
    emojifyInPlace(el, [{ shortcode: "emacs", url: "https://ex.com/emoji/emacs.png" } as never]);
    expect(el.querySelector("img")?.classList.contains("emoji")).toBe(true);
  });
  it("troca :shortcode: por imagem quando o content traz texto puro", () => {
    const el = document.createElement("div");
    el.innerHTML = sanitizeContent("<p>Usando :emacs: e :freebsd_logo: aqui</p>");
    emojifyInPlace(el, [
      { shortcode: "emacs", url: "https://ex.com/emoji/emacs.png" } as never,
      { shortcode: "freebsd_logo", url: "https://ex.com/emoji/freebsd.png" } as never,
    ]);
    const imgs = el.querySelectorAll("img.emoji");
    expect(imgs).toHaveLength(2);
    expect((imgs[0] as HTMLImageElement).src).toContain("emacs.png");
  });

  it("ignora urls não-https", () => {
    const el = document.createElement("div");
    el.innerHTML = sanitizeContent("<p>:emacs:</p>");
    emojifyInPlace(el, [{ shortcode: "emacs", url: "http://ex.com/emoji/emacs.png" } as never]);
    expect(el.querySelectorAll("img.emoji")).toHaveLength(0);
  });

  it("aceita url protocolo-relativa", () => {
    const el = document.createElement("div");
    el.innerHTML = sanitizeContent("<p>:emacs:</p>");
    emojifyInPlace(el, [{ shortcode: "emacs", url: "//ex.com/emoji/emacs.png" } as never]);
    const img = el.querySelector("img.emoji") as HTMLImageElement | null;
    expect(img?.src).toContain("https://ex.com/emoji/emacs.png");
  });
});
