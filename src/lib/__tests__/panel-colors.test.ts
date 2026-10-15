import { describe, expect, it } from "vitest";
import { PANEL_COLORS, updatePanelColor } from "../panel-colors";

describe("updatePanelColor", () => {
  it("sets the color of a panel", () => {
    expect(updatePanelColor({}, "home", "purple")).toEqual({ home: "purple" });
  });

  it("replaces the color of an existing panel", () => {
    expect(updatePanelColor({ home: "purple", local: "blue" }, "home", "pink")).toEqual({
      home: "pink",
      local: "blue",
    });
  });

  it("removes the entry when the color is cleared", () => {
    expect(updatePanelColor({ home: "purple" }, "home", "")).toEqual({});
  });
});

describe("PANEL_COLORS", () => {
  it("offers five color keys", () => {
    expect(PANEL_COLORS).toEqual(["green", "orange", "purple", "blue", "pink"]);
  });
});
