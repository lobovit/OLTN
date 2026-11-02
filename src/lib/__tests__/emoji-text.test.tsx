import { describe, expect, it } from "vitest";
import { render } from "preact";
import { EmojiText } from "../../components/status/EmojiText";

const emojis = [
  { shortcode: "freebsd_logo", url: "https://ex.com/emoji/freebsd.png" },
  { shortcode: "emacs", url: "https://ex.com/emoji/emacs.png" },
] as never;

describe("EmojiText", () => {
  it("replaces shortcodes with images in names", () => {
    const host = document.createElement("div");
    render(<EmojiText text="lobo :freebsd_logo: :emacs:" emojis={emojis} />, host);
    const imgs = host.querySelectorAll("img.emoji");
    expect(imgs).toHaveLength(2);
    expect((imgs[0] as HTMLImageElement).src).toContain("freebsd.png");
    expect((imgs[1] as HTMLImageElement).src).toContain("emacs.png");
    expect(host.textContent).toBe("lobo  ");
  });

  it("supports shortcodes with hyphens", () => {
    const host = document.createElement("div");
    render(
      <EmojiText
        text="lobo :party-parrot:"
        emojis={
          [{ shortcode: "party-parrot", url: "https://ex.com/emoji/party-parrot.png" }] as never
        }
      />,
      host,
    );
    const img = host.querySelector("img.emoji") as HTMLImageElement | null;
    expect(img?.src).toContain("party-parrot.png");
    expect(img?.alt).toBe(":party-parrot:");
  });

  it("without emojis or shortcodes returns plain text", () => {
    const host = document.createElement("div");
    render(<EmojiText text="lobo" emojis={null} />, host);
    expect(host.textContent).toBe("lobo");
    expect(host.querySelectorAll("img")).toHaveLength(0);
  });
});
