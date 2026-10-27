import { describe, expect, it } from "vitest";
import type { Shortcut } from "../../api/types";
import {
  buildLayoutShortcuts,
  clampWidth,
  ensureColumnVisible,
  LAYOUT_PRESETS,
  layoutFromSettings,
  moveInOrder,
  orderColumns,
  routeMode,
  COLUMN_MAX,
  COLUMN_MIN,
} from "../layout";

describe("clampWidth", () => {
  it("respects the column limits", () => {
    expect(clampWidth(100)).toBe(COLUMN_MIN);
    expect(clampWidth(5000)).toBe(COLUMN_MAX);
    expect(clampWidth(420.6)).toBe(421);
  });
});

describe("orderColumns", () => {
  const items = [{ id: "a" }, { id: "b" }, { id: "c" }];

  it("without order preserves the original order", () => {
    expect(orderColumns(items, []).map((x) => x.id)).toEqual(["a", "b", "c"]);
  });

  it("aplica a order salva", () => {
    expect(orderColumns(items, ["c", "a", "b"]).map((x) => x.id)).toEqual(["c", "a", "b"]);
  });

  it("new ids go to the end in the original order", () => {
    expect(orderColumns(items, ["b"]).map((x) => x.id)).toEqual(["b", "a", "c"]);
  });

  it("ids in order that do not exist are ignored", () => {
    expect(orderColumns(items, ["zz", "c"]).map((x) => x.id)).toEqual(["c", "a", "b"]);
  });
});

describe("moveInOrder", () => {
  const ids = ["a", "b", "c"];

  it("moves before the target", () => {
    expect(moveInOrder(ids, "a", "c", "before")).toEqual(["b", "a", "c"]);
  });

  it("moves after the target", () => {
    expect(moveInOrder(ids, "a", "b", "after")).toEqual(["b", "a", "c"]);
  });

  it("moving onto the target itself changes nothing", () => {
    expect(moveInOrder(ids, "a", "a", "before")).toEqual(ids);
  });

  it("a missing target returns the original list", () => {
    expect(moveInOrder(ids, "a", "zz", "before")).toEqual(ids);
  });
});

describe("ensureColumnVisible", () => {
  const shortcut = (id: string): Shortcut => ({ id, type: "home", label: id });

  it("appends at the end when there is room", () => {
    expect(ensureColumnVisible([shortcut("a")], shortcut("b")).map((s) => s.id)).toEqual([
      "a",
      "b",
    ]);
  });

  it("with 6 columns, the new one enters the 6th visible position", () => {
    const base = ["a", "b", "c", "d", "e", "f"].map(shortcut);
    expect(ensureColumnVisible(base, shortcut("g")).map((s) => s.id)).toEqual([
      "a",
      "b",
      "c",
      "d",
      "e",
      "g",
      "f",
    ]);
  });

  it("brings a hidden column into the visible area", () => {
    const base = ["a", "b", "c", "d", "e", "f", "notifications"].map(shortcut);
    expect(ensureColumnVisible(base, shortcut("notifications")).map((s) => s.id)).toEqual([
      "a",
      "b",
      "c",
      "d",
      "e",
      "notifications",
      "f",
    ]);
  });

  it("changes nothing when the column is already visible", () => {
    const base = ["a", "b"].map(shortcut);
    expect(ensureColumnVisible(base, shortcut("a")).map((s) => s.id)).toEqual(["a", "b"]);
  });
});

describe("LAYOUT_PRESETS", () => {
  it("tem 6 layouts combinando 2 a 4 colunas", () => {
    expect(LAYOUT_PRESETS).toHaveLength(6);
    expect(LAYOUT_PRESETS.map((p) => p.columns.length)).toEqual([2, 2, 3, 3, 4, 4]);
  });

  it("covers notifications first and likes in the second column", () => {
    expect(LAYOUT_PRESETS.find((p) => p.id === "foco")?.columns[0].type).toBe("notifications");
    expect(LAYOUT_PRESETS.find((p) => p.id === "curadoria")?.columns[1].type).toBe("favourites");
  });
});

describe("buildLayoutShortcuts", () => {
  const dupla = LAYOUT_PRESETS.find((p) => p.id === "dupla")!;

  it("uses the preset columns in order", () => {
    expect(buildLayoutShortcuts(dupla, []).map((s) => s.id)).toEqual(["home", "notifications"]);
  });

  it("keeps pinned lists and hashtags at the end", () => {
    const existing: Shortcut[] = [
      { id: "list:1", type: "list", label: "Tech", value: "1" },
      { id: "home", type: "home", label: "Início" },
      { id: "hashtag:arte", type: "hashtag", label: "arte", value: "arte" },
    ];
    expect(buildLayoutShortcuts(dupla, existing).map((s) => s.id)).toEqual([
      "home",
      "notifications",
      "list:1",
      "hashtag:arte",
    ]);
  });

  it("replaces default columns outside the layout", () => {
    const existing: Shortcut[] = [
      { id: "home", type: "home", label: "Início" },
      { id: "trending", type: "trending", label: "Em alta" },
    ];
    expect(buildLayoutShortcuts(dupla, existing).map((s) => s.id)).toEqual([
      "home",
      "notifications",
    ]);
  });
});

describe("layoutFromSettings", () => {
  it("reads the new layout and migrates the old deckMode boolean", () => {
    expect(layoutFromSettings({ layout: "social" })).toBe("social");
    expect(layoutFromSettings({ layout: "floats" })).toBe("floats");
    expect(layoutFromSettings({ deckMode: true })).toBe("columns");
    expect(layoutFromSettings({ deckMode: false })).toBe("floats");
    expect(layoutFromSettings({ layout: "bogus", deckMode: false })).toBe("floats");
    expect(layoutFromSettings({})).toBe("columns");
  });
});

describe("routeMode", () => {
  it("uses the chosen layout on the authenticated desktop", () => {
    expect(routeMode("/", true, "columns", true)).toBe("deck");
    expect(routeMode("/", true, "floats", true)).toBe("floats");
  });

  it("uses the social shell on every desktop route", () => {
    expect(routeMode("/", true, "social", true)).toBe("social");
    expect(routeMode("/settings", true, "social", true)).toBe("social");
  });

  it("always uses a single-column page on phones", () => {
    expect(routeMode("/", true, "columns", false)).toBe("page");
    expect(routeMode("/", true, "floats", false)).toBe("page");
    expect(routeMode("/", true, "social", false)).toBe("page");
  });

  it("is a plain page outside the home in deck/float layouts or when anonymous", () => {
    expect(routeMode("/settings", true, "columns", true)).toBe("page");
    expect(routeMode("/", false, "columns", true)).toBe("page");
  });
});
