import { useEffect } from "preact/hooks";

/* Keyboard shortcut engine: combinations + sequences ("g h"). */

export type HotkeyHandler = (e: KeyboardEvent) => void;
export type HotkeyMap = Record<string, HotkeyHandler | undefined>;

const activeMaps = new Set<HotkeyMap>();
let pending = "";
let pendingTimer: number | undefined;

const SEQUENCE_TIMEOUT = 1200;

function isTyping(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable === true;
}

function keyName(e: KeyboardEvent): string {
  let key = e.key.toLowerCase();
  if (key === " ") key = "space";
  if (key === "escape") key = "esc";
  if (key === "arrowup") key = "up";
  if (key === "arrowdown") key = "down";
  if (key === "arrowleft") key = "left";
  if (key === "arrowright") key = "right";
  if (key === "delete") key = "del";
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push("mod");
  if (e.altKey) parts.push("alt");
  if (e.shiftKey) parts.push("shift");
  parts.push(key);
  return parts.join("+");
}

function isSequenceKey(kbd: string): boolean {
  return /^[a-z0-9]$/.test(kbd);
}

function findHandler(kbd: string): HotkeyHandler | null {
  for (const map of activeMaps) {
    const fn = map[kbd];
    if (fn) return fn;
  }
  return null;
}

function hasPrefix(prefix: string): boolean {
  const needle = `${prefix} `;
  for (const map of activeMaps) {
    for (const key of Object.keys(map)) {
      if (key.startsWith(needle)) return true;
    }
  }
  return false;
}

function clearPending() {
  pending = "";
  if (pendingTimer) {
    clearTimeout(pendingTimer);
    pendingTimer = undefined;
  }
}

function onKeydown(e: KeyboardEvent) {
  const kbd = keyName(e);
  const typing = isTyping(e);
  const isEsc = kbd === "esc";
  const hasMod = kbd.startsWith("mod+") || kbd.startsWith("alt+");

  if (typing && !isEsc && !hasMod) return;

  // sequences
  if (pending) {
    const combined = `${pending} ${kbd}`;
    const handler = findHandler(combined);
    clearPending();
    if (handler) {
      e.preventDefault();
      handler(e);
      return;
    }
  }

  const handler = findHandler(kbd);
  if (handler) {
    e.preventDefault();
    clearPending();
    handler(e);
    return;
  }

  if (isSequenceKey(kbd) && hasPrefix(kbd)) {
    pending = kbd;
    if (pendingTimer) clearTimeout(pendingTimer);
    pendingTimer = window.setTimeout(clearPending, SEQUENCE_TIMEOUT);
  }
}

let installed = false;
function ensureInstalled() {
  if (installed) return;
  installed = true;
  window.addEventListener("keydown", onKeydown);
}

export function useHotkeys(map: HotkeyMap, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    ensureInstalled();
    activeMaps.add(map);
    return () => {
      activeMaps.delete(map);
    };
  }, [map, enabled]);
}
