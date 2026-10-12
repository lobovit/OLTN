import { describe, expect, it } from "vitest";
import { scrollParentOf } from "../scroll";

function fakeScroller(overflow: string, height: number, client: number): HTMLElement {
  const el = document.createElement("div");
  el.style.overflowY = overflow;
  Object.defineProperty(el, "scrollHeight", { value: height });
  Object.defineProperty(el, "clientHeight", { value: client });
  return el;
}

describe("scrollParentOf", () => {
  it("finds the nearest vertically scrollable ancestor", () => {
    const outer = fakeScroller("auto", 1000, 300);
    const inner = document.createElement("div");
    const from = document.createElement("span");
    inner.appendChild(from);
    outer.appendChild(inner);
    expect(scrollParentOf(from)).toBe(outer);
  });

  it("skips ancestors that do not scroll or do not overflow", () => {
    const hidden = fakeScroller("hidden", 1000, 300);
    const short = fakeScroller("auto", 300, 300);
    const from = document.createElement("span");
    short.appendChild(from);
    hidden.appendChild(short);
    expect(scrollParentOf(from)).toBe(null);
  });

  it("handles a detached node", () => {
    expect(scrollParentOf(null)).toBe(null);
  });
});
