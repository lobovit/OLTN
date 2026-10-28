import { describe, expect, it } from "vitest";
import { render } from "preact";
import { VisibilityPicker } from "../../components/compose/VisibilityPicker";

describe("VisibilityPicker", () => {
  it("locks the dropdown when editing (Mastodon ignores visibility changes)", () => {
    const host = document.createElement("div");
    render(
      <VisibilityPicker
        value="public"
        localSupported={false}
        onChange={() => {}}
        disabled
        disabledHint="locked while editing"
      />,
      host,
    );
    const button = host.querySelector<HTMLButtonElement>(".vis-btn");
    expect(button?.disabled).toBe(true);
    expect(button?.title).toBe("locked while editing");
    button?.click();
    expect(host.querySelector(".vis-menu")).toBeNull();
  });

  it("opens the menu when enabled", async () => {
    const host = document.createElement("div");
    render(<VisibilityPicker value="public" localSupported={false} onChange={() => {}} />, host);
    host.querySelector<HTMLButtonElement>(".vis-btn")?.click();
    await Promise.resolve();
    expect(host.querySelector(".vis-menu")).toBeTruthy();
  });
});
