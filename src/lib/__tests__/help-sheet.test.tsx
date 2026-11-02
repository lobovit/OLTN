import { beforeEach, describe, expect, it } from "vitest";
import { render } from "preact";
import { HelpSheet } from "../../components/help/HelpSheet";
import { store } from "../../state/store";

describe("HelpSheet", () => {
  beforeEach(() => {
    store.ui.helpOpen = false;
  });

  it("does not render when closed", () => {
    const host = document.createElement("div");
    render(<HelpSheet />, host);
    expect(host.querySelector(".help-sheet")).toBeNull();
  });

  it("shows the doc sections when open", () => {
    store.ui.helpOpen = true;
    const host = document.createElement("div");
    render(<HelpSheet />, host);
    const sheet = host.querySelector(".help-sheet");
    expect(sheet).toBeTruthy();
    expect(host.querySelectorAll(".help-quick .help-steps li").length).toBe(3);
    expect(host.querySelectorAll(".help-contents-link").length).toBe(3);
    expect(host.querySelectorAll(".help-sheet section").length).toBe(4);
    expect(host.querySelectorAll(".help-topic").length).toBe(21);
    expect(host.querySelectorAll(".help-topic-icon .icon").length).toBe(21);
    expect(host.textContent).toContain("Gmail");
    expect(host.textContent).toContain("ActivityPub");
    expect(host.textContent).toContain("Home");
    expect(host.textContent).toContain("Messages");
    expect(host.textContent).toContain("Fediverse Apps");
    expect(host.textContent).toContain("Code as an image");
    expect(host.querySelector(".help-code")?.textContent).toContain("```python");
  });
});
