/* Pure geometry for the floating panels (deck mode off): cascade placement,
   clamping into the canvas and stacking order. */

import type { FloatRect } from "../api/types";
import { clampNumber } from "./layout";

export const FLOAT_MIN_W = 280;
export const FLOAT_MIN_H = 220;
export const FLOAT_DEFAULT_W = 380;
export const FLOAT_DEFAULT_H = 460;
export const FLOAT_MARGIN = 16;
export const FLOAT_CASCADE = 28;
/** Magnet radius: within this distance a panel sticks to edges and neighbors. */
export const FLOAT_SNAP = 12;

function cascade(offset: number, span: number): number {
  return FLOAT_MARGIN + (offset % Math.max(1, span));
}

/** Default rect for a new panel: cascaded from the top-left, wrapped and clamped
    into the canvas, with the default size shrunk on small canvases. */
export function floatDefaults(index: number, canvasW: number, canvasH: number): FloatRect {
  const w = Math.min(FLOAT_DEFAULT_W, Math.max(FLOAT_MIN_W, canvasW - 2 * FLOAT_MARGIN));
  const h = Math.min(FLOAT_DEFAULT_H, Math.max(FLOAT_MIN_H, canvasH - 2 * FLOAT_MARGIN));
  return {
    x: cascade(index * FLOAT_CASCADE, canvasW - w - 2 * FLOAT_MARGIN),
    y: cascade(index * FLOAT_CASCADE, canvasH - h - 2 * FLOAT_MARGIN),
    w,
    h,
  };
}

/** Keeps a panel reachable: size clamped to the canvas, position pulled inside. */
export function clampFloatRect(rect: FloatRect, canvasW: number, canvasH: number): FloatRect {
  const w = clampNumber(rect.w, FLOAT_MIN_W, Math.max(FLOAT_MIN_W, canvasW - 2 * FLOAT_MARGIN));
  const h = clampNumber(rect.h, FLOAT_MIN_H, Math.max(FLOAT_MIN_H, canvasH - 2 * FLOAT_MARGIN));
  return {
    x: clampNumber(rect.x, FLOAT_MARGIN, Math.max(FLOAT_MARGIN, canvasW - w - FLOAT_MARGIN)),
    y: clampNumber(rect.y, FLOAT_MARGIN, Math.max(FLOAT_MARGIN, canvasH - h - FLOAT_MARGIN)),
    w,
    h,
  };
}

/** Moves `id` to the end of the stacking order (front), dropping duplicates. */
export function bringToFront(order: readonly string[], id: string): string[] {
  const seen = new Set<string>([id]);
  const rest: string[] = [];
  for (const value of order) {
    if (seen.has(value)) continue;
    seen.add(value);
    rest.push(value);
  }
  return [...rest, id];
}

/** Total stacking order: known ids keep their order, new ids append in list order. */
export function stackOrder(order: readonly string[], ids: readonly string[]): string[] {
  const valid = new Set(ids);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const id of [...order, ...ids]) {
    if (!valid.has(id) || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}

function nearest(value: number, candidates: readonly number[], threshold: number): number {
  let best: number | null = null;
  let bestDistance = threshold + 1;
  for (const candidate of candidates) {
    const distance = Math.abs(candidate - value);
    if (distance <= threshold && distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best ?? value;
}

/** Clamps the rect, then magnetically sticks it to the canvas margins and to
    the edges of the other panels (each axis independently). */
export function snapFloatRect(
  rect: FloatRect,
  others: readonly FloatRect[],
  canvasW: number,
  canvasH: number,
  threshold = FLOAT_SNAP,
): FloatRect {
  const base = clampFloatRect(rect, canvasW, canvasH);
  const xs = [FLOAT_MARGIN, canvasW - base.w - FLOAT_MARGIN];
  const ys = [FLOAT_MARGIN, canvasH - base.h - FLOAT_MARGIN];
  for (const other of others) {
    const peer = clampFloatRect(other, canvasW, canvasH);
    xs.push(peer.x, peer.x + peer.w, peer.x - base.w);
    ys.push(peer.y, peer.y + peer.h, peer.y - base.h);
  }
  return {
    ...base,
    x: nearest(base.x, xs, threshold),
    y: nearest(base.y, ys, threshold),
  };
}
