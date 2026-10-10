import { describe, expect, it } from "vitest";
import { render } from "preact";
import { EmojiText } from "../../components/status/EmojiText";

const emojis = [
  { shortcode: "freebsd_logo", url: "https://ex.com/emoji/freebsd.png" },
  { shortcode: "emacs", url: "https://ex.com/emoji/emacs.png" },
] as never;

describe("EmojiText", () => {
  it("troca shortcodes por imagens em nomes", () => {
    const host = document.createElement("div");
    render(<EmojiText text="lobo :freebsd_logo: :emacs:" emojis={emojis} />, host);
    const imgs = host.querySelectorAll("img.emoji");
    expect(imgs).toHaveLength(2);
    expect((imgs[0] as HTMLImageElement).src).toContain("freebsd.png");
    expect((imgs[1] as HTMLImageElement).src).toContain("emacs.png");
    expect(host.textContent).toBe("lobo  ");
  });

  it("sem emojis ou sem shortcode devolve texto puro", () => {
    const host = document.createElement("div");
    render(<EmojiText text="lobo" emojis={null} />, host);
    expect(host.textContent).toBe("lobo");
    expect(host.querySelectorAll("img")).toHaveLength(0);
  });
});
