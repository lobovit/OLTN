import { describe, expect, it } from "vitest";
import {
  bringToFront,
  clampFloatRect,
  floatDefaults,
  snapFloatRect,
  stackOrder,
  FLOAT_DEFAULT_H,
  FLOAT_DEFAULT_W,
  FLOAT_MARGIN,
  FLOAT_MIN_H,
  FLOAT_MIN_W,
} from "../floats";

describe("floatDefaults", () => {
  it("places the first panel at the canvas margin with the default size", () => {
    expect(floatDefaults(0, 1200, 800)).toEqual({
      x: FLOAT_MARGIN,
      y: FLOAT_MARGIN,
      w: FLOAT_DEFAULT_W,
      h: FLOAT_DEFAULT_H,
    });
  });

  it("cascades each next panel by a fixed offset", () => {
    expect(floatDefaults(3, 1200, 800)).toEqual({ x: 100, y: 100, w: 380, h: 460 });
  });

  it("wraps the cascade inside the canvas when it overflows", () => {
    expect(floatDefaults(30, 1200, 800)).toEqual({ x: 68, y: 240, w: 380, h: 460 });
  });

  it("shrinks the default size on a small canvas", () => {
    expect(floatDefaults(0, 400, 300)).toEqual({ x: 16, y: 16, w: 368, h: 268 });
  });
});

describe("clampFloatRect", () => {
  it("keeps a rect already inside the canvas unchanged", () => {
    const rect = { x: 100, y: 80, w: 380, h: 460 };
    expect(clampFloatRect(rect, 1200, 800)).toEqual(rect);
  });

  it("pulls a rect back inside the canvas edges", () => {
    expect(clampFloatRect({ x: 1100, y: -50, w: 400, h: 460 }, 1200, 800)).toEqual({
      x: 784,
      y: FLOAT_MARGIN,
      w: 400,
      h: 460,
    });
  });

  it("shrinks a rect larger than the canvas", () => {
    expect(clampFloatRect({ x: 40, y: 40, w: 2000, h: 1200 }, 1200, 800)).toEqual({
      x: FLOAT_MARGIN,
      y: FLOAT_MARGIN,
      w: 1168,
      h: 768,
    });
  });

  it("raises tiny rects to the minimum size", () => {
    expect(clampFloatRect({ x: 200, y: 150, w: 100, h: 100 }, 1200, 800)).toEqual({
      x: 200,
      y: 150,
      w: FLOAT_MIN_W,
      h: FLOAT_MIN_H,
    });
  });
});

describe("bringToFront", () => {
  it("moves the panel to the end of the order", () => {
    expect(bringToFront(["home", "notifications"], "home")).toEqual(["notifications", "home"]);
  });

  it("appends a panel that is not in the order yet", () => {
    expect(bringToFront(["home", "notifications"], "local")).toEqual([
      "home",
      "notifications",
      "local",
    ]);
  });

  it("drops stale duplicates of the panel", () => {
    expect(bringToFront(["a", "b", "a"], "b")).toEqual(["a", "b"]);
  });
});

describe("stackOrder", () => {
  it("completes the order with the panels that are not in it", () => {
    expect(stackOrder(["notifications"], ["home", "notifications", "local"])).toEqual([
      "notifications",
      "home",
      "local",
    ]);
  });

  it("keeps the relative order of known panels", () => {
    expect(stackOrder(["local", "home"], ["home", "notifications", "local"])).toEqual([
      "local",
      "home",
      "notifications",
    ]);
  });

  it("drops stale ids and duplicates", () => {
    expect(stackOrder(["ghost", "home", "home", "local"], ["home", "local"])).toEqual([
      "home",
      "local",
    ]);
  });
});

describe("snapFloatRect", () => {
  it("sticks to the left margin when close", () => {
    const rect = snapFloatRect({ x: 10, y: 200, w: 380, h: 460 }, [], 1200, 900);
    expect(rect).toEqual({ x: FLOAT_MARGIN, y: 200, w: 380, h: 460 });
  });

  it("sticks to the right edge when close", () => {
    const rect = snapFloatRect({ x: 798, y: 200, w: 380, h: 460 }, [], 1200, 900);
    expect(rect).toEqual({ x: 804, y: 200, w: 380, h: 460 });
  });

  it("stays put when nothing is within the threshold", () => {
    const rect = snapFloatRect({ x: 200, y: 200, w: 380, h: 460 }, [], 1200, 900);
    expect(rect).toEqual({ x: 200, y: 200, w: 380, h: 460 });
  });

  it("aligns the left edge with another panel", () => {
    const other = { x: 248, y: 500, w: 380, h: 460 };
    const rect = snapFloatRect({ x: 254, y: 200, w: 380, h: 460 }, [other], 1200, 900);
    expect(rect.x).toBe(248);
    expect(rect.y).toBe(200);
  });

  it("sticks below another panel", () => {
    const other = { x: 16, y: 16, w: 380, h: 460 };
    const rect = snapFloatRect({ x: 500, y: 470, w: 380, h: 460 }, [other], 1200, 1000);
    expect(rect).toEqual({ x: 500, y: 476, w: 380, h: 460 });
  });

  it("sticks side by side with another panel's left edge", () => {
    const other = { x: 648, y: 16, w: 380, h: 460 };
    const rect = snapFloatRect({ x: 262, y: 100, w: 380, h: 460 }, [other], 1200, 900);
    expect(rect.x).toBe(268);
    expect(rect.y).toBe(100);
  });
});
