import { describe, expect, it } from "vitest";
import { clamp, dropTarget } from "../pointer-drag";

describe("clamp", () => {
  it("keeps values inside the range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });

  it("returns the midpoint of a collapsed range", () => {
    expect(clamp(5, 10, 0)).toBe(5);
  });
});

describe("dropTarget", () => {
  const extents = [
    { start: 0, end: 100 },
    { start: 100, end: 200 },
  ];

  it("picks before/after by the midpoint of the hit extent", () => {
    expect(dropTarget(extents, 40)).toEqual({ index: 0, side: "before" });
    expect(dropTarget(extents, 60)).toEqual({ index: 0, side: "after" });
    expect(dropTarget(extents, 130)).toEqual({ index: 1, side: "before" });
    expect(dropTarget(extents, 150)).toEqual({ index: 1, side: "after" });
  });

  it("clamps to the first/last extent outside the range", () => {
    expect(dropTarget(extents, -10)).toEqual({ index: 0, side: "before" });
    expect(dropTarget(extents, 999)).toEqual({ index: 1, side: "after" });
  });

  it("returns null without extents", () => {
    expect(dropTarget([], 10)).toBeNull();
  });
});
