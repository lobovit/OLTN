/* One pointer-drag seam for every gesture (rail reorder, column reorder,
   column resize, sheet drag, sheet resize): capture, move/up/cancel, Escape
   cancel and teardown live here. Surfaces only describe move/commit and
   apply their own DOM/styling. */

import { useCallback, useEffect, useRef } from "preact/hooks";

/** Clamps into [min, max]; a collapsed range returns its midpoint. */
export function clamp(value: number, min: number, max: number): number {
  if (min > max) return (min + max) / 2;
  return Math.min(Math.max(value, min), max);
}

export interface Extent {
  start: number;
  end: number;
}

export interface DropTarget {
  index: number;
  side: "before" | "after";
}

/** Midpoint hit-testing over extents (rail items, columns). */
export function dropTarget(extents: readonly Extent[], coord: number): DropTarget | null {
  if (!extents.length) return null;
  for (let i = 0; i < extents.length; i++) {
    const { start, end } = extents[i];
    if (coord >= start && coord <= end) {
      return { index: i, side: coord < start + (end - start) / 2 ? "before" : "after" };
    }
  }
  return coord < extents[0].start
    ? { index: 0, side: "before" }
    : { index: extents.length - 1, side: "after" };
}

export interface PointerDragContext {
  event: PointerEvent;
  start: { x: number; y: number };
  delta: { x: number; y: number };
}

export interface PointerDragOptions {
  /** Pixels of movement before the gesture starts (default 0 = immediately). */
  threshold?: number;
  onStart?: (ctx: PointerDragContext) => void;
  onMove: (ctx: PointerDragContext) => void;
  onCommit: (ctx: PointerDragContext) => void;
  onCancel?: (ctx: PointerDragContext) => void;
}

/**
 * Core gesture pipeline: window pointermove/up/cancel + Escape (capture, so
 * it cancels the gesture and does not bubble to global hotkeys). Returns a
 * teardown that only removes listeners (safe to call on unmount).
 */
export function beginPointerDrag(e: PointerEvent, options: PointerDragOptions): () => void {
  if (e.button > 0) return () => {};
  e.preventDefault();
  const source = e.currentTarget as HTMLElement | null;
  const pointerId = e.pointerId;
  const start = { x: e.clientX, y: e.clientY };
  const threshold = options.threshold ?? 0;
  let last: PointerEvent = e;
  let started = false;
  let done = false;

  const context = (ev: PointerEvent): PointerDragContext => ({
    event: ev,
    start,
    delta: { x: ev.clientX - start.x, y: ev.clientY - start.y },
  });

  const teardown = (): void => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onCancel);
    window.removeEventListener("keydown", onKey, true);
  };

  const finish = (cancelled: boolean): void => {
    if (done) return;
    done = true;
    teardown();
    if (!started) return;
    if (cancelled) options.onCancel?.(context(last));
    else options.onCommit(context(last));
  };

  const onMove = (ev: PointerEvent): void => {
    last = ev;
    if (!started) {
      const dx = Math.abs(ev.clientX - start.x);
      const dy = Math.abs(ev.clientY - start.y);
      if (Math.max(dx, dy) < threshold) return;
      started = true;
      try {
        source?.setPointerCapture?.(pointerId);
      } catch {
        /* noop */
      }
      options.onStart?.(context(ev));
    }
    options.onMove(context(ev));
  };
  const onUp = (ev: PointerEvent): void => {
    last = ev;
    finish(false);
  };
  const onCancel = (ev: PointerEvent): void => {
    last = ev;
    finish(true);
  };
  const onKey = (ev: KeyboardEvent): void => {
    if (ev.key !== "Escape") return;
    ev.preventDefault();
    ev.stopPropagation();
    finish(true);
  };

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onCancel);
  window.addEventListener("keydown", onKey, true);
  return teardown;
}

/** Hook wrapper: keeps the latest options and cancels on unmount. */
export function usePointerDrag(options: PointerDragOptions): (e: PointerEvent) => void {
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const teardownRef = useRef<(() => void) | null>(null);
  useEffect(
    () => () => {
      teardownRef.current?.();
    },
    [],
  );
  return useCallback((e: PointerEvent) => {
    teardownRef.current = beginPointerDrag(e, optionsRef.current);
  }, []);
}
