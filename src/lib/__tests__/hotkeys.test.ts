import { describe, expect, it } from "vitest";
import { keyName } from "../hotkeys";

const noMods = { ctrlKey: false, metaKey: false, altKey: false, shiftKey: false };

describe("keyName", () => {
  it("returns null for keydown events without a key", () => {
    expect(keyName({ ...noMods } as KeyboardEvent)).toBe(null);
  });

  it("normalizes key names and modifiers", () => {
    expect(keyName({ ...noMods, key: " " } as KeyboardEvent)).toBe("space");
    expect(keyName({ ...noMods, key: "Escape" } as KeyboardEvent)).toBe("esc");
    expect(keyName({ ...noMods, ctrlKey: true, key: "H" } as KeyboardEvent)).toBe("mod+h");
  });
});
