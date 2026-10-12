/* Scroll helpers for feeds: find the scrollable ancestor and go back to top. */

/** Nearest ancestor that scrolls vertically with overflowing content. */
export function scrollParentOf(from: HTMLElement | null): HTMLElement | null {
  for (let el = from?.parentElement ?? null; el; el = el.parentElement) {
    // Inline first: some DOM implementations (happy-dom) do not reflect it.
    const overflowY = el.style.overflowY || getComputedStyle(el).overflowY;
    if (/(auto|scroll|overlay)/.test(overflowY) && el.scrollHeight > el.clientHeight) return el;
  }
  return null;
}

/** Goes back to the top of the feed after the queued posts are merged in. */
export function scrollFeedToTop(from: HTMLElement | null): void {
  const container = scrollParentOf(from);
  if (container) {
    container.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}
