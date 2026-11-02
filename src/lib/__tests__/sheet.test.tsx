import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "preact";
import { Sheet } from "../../components/ui/Sheet";

afterEach(() => {
  document.body.innerHTML = "";
});

function renderSheet(onClose: () => void): HTMLElement {
  const host = document.createElement("div");
  document.body.append(host);
  render(
    <Sheet title="Test" onClose={onClose}>
      <button type="button">Inside</button>
    </Sheet>,
    host,
  );
  return host;
}

describe("Sheet backdrop", () => {
  it("closes when the pointer starts on the backdrop", () => {
    const onClose = vi.fn();
    const host = renderSheet(onClose);
    host
      .querySelector(".overlay-backdrop")
      ?.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("ignores a click that ends on the backdrop", () => {
    const onClose = vi.fn();
    const host = renderSheet(onClose);
    host.querySelector(".overlay-backdrop")?.dispatchEvent(new Event("click", { bubbles: true }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("ignores pointer presses inside the sheet", () => {
    const onClose = vi.fn();
    const host = renderSheet(onClose);
    host.querySelector(".sheet button")?.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(onClose).not.toHaveBeenCalled();
  });
});
