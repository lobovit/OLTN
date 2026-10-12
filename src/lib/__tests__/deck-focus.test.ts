import { describe, expect, it } from "vitest";
import { focusableCards, nextFocusIndex } from "../deck-focus";

describe("nextFocusIndex", () => {
  it("moves within bounds", () => {
    expect(nextFocusIndex(1, 1, 3)).toBe(2);
    expect(nextFocusIndex(1, -1, 3)).toBe(0);
  });

  it("clamps at the edges", () => {
    expect(nextFocusIndex(2, 1, 3)).toBe(2);
    expect(nextFocusIndex(0, -1, 3)).toBe(0);
    expect(nextFocusIndex(-1, 0, 3)).toBe(0);
  });

  it("returns -1 with nothing to focus", () => {
    expect(nextFocusIndex(0, 1, 0)).toBe(-1);
  });
});

describe("focusableCards", () => {
  it("finds data-focusable cards inside scroll containers only", () => {
    document.body.innerHTML = `
      <div class="deck-body">
        <article data-focusable id="a"></article>
        <article id="ignored-class-only" class="status-card"></article>
        <article data-focusable id="b"></article>
      </div>
      <article data-focusable id="outside"></article>
    `;
    expect(focusableCards().map((el) => el.id)).toEqual(["a", "b"]);
    document.body.innerHTML = "";
  });
});
