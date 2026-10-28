import { describe, expect, it } from "vitest";
import type { List, Shortcut } from "../../api/types";
import {
  isListPinned,
  listShortcut,
  removeListShortcut,
  renameListShortcut,
  toggleListShortcut,
} from "../lists";

const list = (id: string, title: string): List => ({ id, title }) as List;

describe("list shortcuts", () => {
  it("builds the same id used by the shortcuts settings", () => {
    expect(listShortcut(list("7", "Friends"))).toEqual({
      id: "list:7",
      type: "list",
      label: "Friends",
      value: "7",
    });
  });

  it("toggles pinning without touching other shortcuts", () => {
    const home: Shortcut = { id: "home", type: "home", label: "Home" };
    const pinned = toggleListShortcut([home], list("7", "Friends"));
    expect(pinned.map((shortcut) => shortcut.id)).toEqual(["home", "list:7"]);
    expect(isListPinned(pinned, "7")).toBe(true);
    const unpinned = toggleListShortcut(pinned, list("7", "Friends"));
    expect(unpinned.map((shortcut) => shortcut.id)).toEqual(["home"]);
    expect(isListPinned(unpinned, "7")).toBe(false);
  });

  it("removes only the matching list", () => {
    const shortcuts = [listShortcut(list("7", "Friends")), listShortcut(list("8", "News"))];
    expect(removeListShortcut(shortcuts, "7").map((shortcut) => shortcut.id)).toEqual(["list:8"]);
  });

  it("renames a pinned list in place", () => {
    const shortcuts = [listShortcut(list("7", "Friends")), listShortcut(list("8", "News"))];
    const renamed = renameListShortcut(shortcuts, list("7", "Close friends"));
    expect(renamed[0]).toMatchObject({ id: "list:7", label: "Close friends" });
    expect(renamed[1]).toEqual(shortcuts[1]);
  });
});
