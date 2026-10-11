import { beforeEach, describe, expect, it } from "vitest";
import { render } from "preact";
import { HelpSheet } from "../../components/help/HelpSheet";
import { store } from "../../state/store";

describe("HelpSheet", () => {
  beforeEach(() => {
    store.ui.helpOpen = false;
  });

  it("não renderiza quando fechado", () => {
    const host = document.createElement("div");
    render(<HelpSheet />, host);
    expect(host.querySelector(".help-sheet")).toBeNull();
  });

  it("mostra as seções da doc quando aberto", () => {
    store.ui.helpOpen = true;
    const host = document.createElement("div");
    render(<HelpSheet />, host);
    const sheet = host.querySelector(".help-sheet");
    expect(sheet).toBeTruthy();
    expect(host.querySelectorAll(".help-sheet section").length).toBe(9);
    expect(host.textContent).toContain("Timelines");
    expect(host.querySelector(".help-code")?.textContent).toContain("```python");
  });
});
