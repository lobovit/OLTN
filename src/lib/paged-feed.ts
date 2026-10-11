/* Pure state machine for a paged feed: cursor, dedupe, hasMore, first-page
   error vs pagination error. No fetch, no store — the "has more pages" rule
   lives in the adapter, in a single place. */

export interface FeedPage<T> {
  items: readonly T[];
  /** The adapter decides it (single rule per endpoint, not per view). */
  hasMore: boolean;
}

export interface FeedAdapter<T> {
  /** Fetches one page from the cursor (null = first). */
  fetchPage(cursor: string | null): Promise<FeedPage<T>>;
  /** Identity used for dedupe and merge. */
  keyOf(item: T): string;
  /** Cursor for the next page, derived from the last item. */
  cursorOf(item: T): string | null;
}

export interface FeedState<T> {
  items: readonly T[];
  loading: boolean;
  loadingMore: boolean;
  /** First-page error (full error state). */
  error: unknown;
  /** Pagination error (inline, does not hide the list). */
  moreError: unknown;
  /** First page finished. */
  ready: boolean;
  hasMore: boolean;
  cursor: string | null;
}

export function initialFeedState<T>(): FeedState<T> {
  return {
    items: [],
    loading: false,
    loadingMore: false,
    error: null,
    moreError: null,
    ready: false,
    hasMore: false,
    cursor: null,
  };
}

export type FeedEvent<T> =
  | { type: "start"; scope: "initial" | "more" }
  | { type: "page"; scope: "initial" | "more"; page: FeedPage<T> }
  | { type: "fail"; scope: "initial" | "more"; error: unknown }
  | { type: "prepend"; items: readonly T[] }
  | { type: "patch"; key: string; patch: Partial<T> };

function freshItems<T>(
  existing: readonly T[],
  incoming: readonly T[],
  keyOf: (item: T) => string,
): T[] {
  const seen = new Set(existing.map(keyOf));
  const fresh: T[] = [];
  for (const item of incoming) {
    const key = keyOf(item);
    if (seen.has(key)) continue;
    seen.add(key);
    fresh.push(item);
  }
  return fresh;
}

function nextCursor<T>(
  items: readonly T[],
  adapter: Pick<FeedAdapter<T>, "cursorOf">,
): string | null {
  const last = items[items.length - 1];
  return last === undefined ? null : adapter.cursorOf(last);
}

export function feedReducer<T>(
  state: FeedState<T>,
  event: FeedEvent<T>,
  adapter: Pick<FeedAdapter<T>, "keyOf" | "cursorOf">,
): FeedState<T> {
  switch (event.type) {
    case "start":
      return event.scope === "initial"
        ? { ...state, loading: true, error: null }
        : { ...state, loadingMore: true, moreError: null };
    case "page": {
      const fresh = freshItems(state.items, event.page.items, adapter.keyOf);
      if (event.scope === "initial") {
        return {
          items: fresh,
          loading: false,
          loadingMore: false,
          error: null,
          moreError: null,
          ready: true,
          hasMore: event.page.hasMore,
          cursor: nextCursor(fresh, adapter),
        };
      }
      return {
        ...state,
        items: [...state.items, ...fresh],
        loadingMore: false,
        hasMore: event.page.hasMore,
        cursor: fresh.length ? nextCursor(fresh, adapter) : state.cursor,
      };
    }
    case "fail":
      return event.scope === "initial"
        ? { ...state, loading: false, error: event.error }
        : { ...state, loadingMore: false, moreError: event.error };
    case "prepend": {
      const fresh = freshItems(state.items, event.items, adapter.keyOf);
      return fresh.length ? { ...state, items: [...fresh, ...state.items] } : state;
    }
    case "patch":
      return {
        ...state,
        items: state.items.map((item) =>
          adapter.keyOf(item) === event.key ? { ...item, ...event.patch } : item,
        ),
      };
    default:
      return state;
  }
}
