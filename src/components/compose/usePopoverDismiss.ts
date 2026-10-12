import { useEffect, useRef } from "preact/hooks";

export interface PopoverEntry {
  /** Whether the popover is currently open. */
  isOpen: boolean;
  /** Selector of the panel; clicks inside it do not close the popover. */
  panel: string;
  /** Selector of the toggle button; it handles its own open/close. */
  toggle: string;
  close: () => void;
}

/** Closes the given popovers on an outside pointerdown or Escape. */
export function usePopoverDismiss(entries: readonly PopoverEntry[]): void {
  const latest = useRef(entries);
  latest.current = entries;
  const openKey = entries.map((entry) => (entry.isOpen ? "1" : "0")).join("");

  useEffect(() => {
    if (!openKey.includes("1")) return;
    const onDown = (e: PointerEvent): void => {
      const el = e.target as HTMLElement;
      for (const entry of latest.current) {
        if (entry.isOpen && !el.closest(entry.panel) && !el.closest(entry.toggle)) entry.close();
      }
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== "Escape") return;
      for (const entry of latest.current) entry.close();
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [openKey]);
}
