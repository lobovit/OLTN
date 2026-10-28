import type { List, Shortcut } from "../api/types";

/** Shortcut that pins a list as a deck column / floating panel / mobile row. */
export function listShortcut(list: Pick<List, "id" | "title">): Shortcut {
  return { id: `list:${list.id}`, type: "list", label: list.title, value: list.id };
}

export function isListPinned(shortcuts: readonly Shortcut[], listId: string): boolean {
  return shortcuts.some((shortcut) => shortcut.type === "list" && shortcut.value === listId);
}

export function removeListShortcut(shortcuts: readonly Shortcut[], listId: string): Shortcut[] {
  return shortcuts.filter((shortcut) => !(shortcut.type === "list" && shortcut.value === listId));
}

export function toggleListShortcut(
  shortcuts: readonly Shortcut[],
  list: Pick<List, "id" | "title">,
): Shortcut[] {
  return isListPinned(shortcuts, list.id)
    ? removeListShortcut(shortcuts, list.id)
    : [...shortcuts, listShortcut(list)];
}

/** Keeps a pinned list label in sync after renaming the list. */
export function renameListShortcut(
  shortcuts: readonly Shortcut[],
  list: Pick<List, "id" | "title">,
): Shortcut[] {
  return shortcuts.map((shortcut) =>
    shortcut.type === "list" && shortcut.value === list.id
      ? { ...shortcut, label: list.title }
      : shortcut,
  );
}
