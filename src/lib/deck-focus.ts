/* Deck keyboard focus: index math is pure and the DOM query uses the
   semantic data-focusable attribute instead of a styling class, so renaming
   CSS never breaks j/k navigation. */

const FOCUSABLE_SELECTOR = ".deck-body [data-focusable]";

/** Clamped next index for j/k navigation (-1 when there is nothing to focus). */
export function nextFocusIndex(current: number, delta: number, total: number): number {
  if (total <= 0) return -1;
  return Math.min(Math.max(current + delta, 0), total - 1);
}

/** Focusable cards of every mounted deck/page scroll container, in DOM order. */
export function focusableCards(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)];
}
