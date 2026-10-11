import { useCallback, useEffect, useReducer, useRef } from "preact/hooks";
import { useSnapshot } from "valtio";
import type { Status } from "../api/types";
import {
  feedReducer,
  initialFeedState,
  type FeedAdapter,
  type FeedEvent,
  type FeedState,
} from "../lib/paged-feed";
import { store } from "./store";

export function useStatus(key: string): Status | undefined {
  const snap = useSnapshot(store.statuses);
  return snap[key] as unknown as Status | undefined;
}

export function useAppState() {
  return useSnapshot(store);
}

export interface PagedFeedOptions<T> {
  /** Feed identity; changing it triggers a reload (kind, instance, mode…). */
  key: string;
  /** May be recreated on every render — the hook keeps the latest version. */
  adapter: FeedAdapter<T>;
  /** Streaming items that can be merged (already resolved into entities). */
  queue?: readonly T[];
  /** "manual" exposes the queue as a pill; "auto" merges as soon as they arrive. */
  queueMode?: "manual" | "auto";
  enabled?: boolean;
  /** First page ready (e.g. clear the notifications badge). */
  onReady?: (items: readonly T[]) => void;
  /** Manually merged queue (e.g. clearing the global queue). */
  onFlushQueue?: () => void;
}

export interface PagedFeed<T> {
  items: readonly T[];
  loading: boolean;
  loadingMore: boolean;
  error: unknown;
  moreError: unknown;
  hasMore: boolean;
  /** Visible queue (mode "manual"). */
  queue: readonly T[];
  reload: () => void;
  loadMore: () => void;
  flushQueue: () => void;
  patch: (key: string, patch: Partial<T>) => void;
}

/** Connects the pure paged-feed machine to fetch and streaming queues. */
export function usePagedFeed<T>(options: PagedFeedOptions<T>): PagedFeed<T> {
  const { key, queue = [], queueMode = "manual", enabled = true, onFlushQueue } = options;
  const adapterRef = useRef(options.adapter);
  adapterRef.current = options.adapter;
  const onReadyRef = useRef(options.onReady);
  onReadyRef.current = options.onReady;

  const [state, dispatch] = useReducer(
    (current: FeedState<T>, event: FeedEvent<T>): FeedState<T> =>
      feedReducer(current, event, adapterRef.current),
    undefined,
    initialFeedState<T>,
  );
  const tokenRef = useRef(0);

  const loadInitial = useCallback(() => {
    const token = ++tokenRef.current;
    dispatch({ type: "start", scope: "initial" });
    void (async () => {
      try {
        const page = await adapterRef.current.fetchPage(null);
        if (token !== tokenRef.current) return;
        dispatch({ type: "page", scope: "initial", page });
        onReadyRef.current?.(page.items);
      } catch (error) {
        console.warn("[oltn] feed load failed", error);
        if (token === tokenRef.current) dispatch({ type: "fail", scope: "initial", error });
      }
    })();
  }, []);

  useEffect(() => {
    if (!enabled) return;
    loadInitial();
    return () => {
      tokenRef.current += 1;
    };
  }, [key, enabled, loadInitial]);

  const loadMore = useCallback(() => {
    if (state.loadingMore || !state.hasMore || !state.cursor) return;
    const token = tokenRef.current;
    const cursor = state.cursor;
    dispatch({ type: "start", scope: "more" });
    void (async () => {
      try {
        const page = await adapterRef.current.fetchPage(cursor);
        if (token !== tokenRef.current) return;
        dispatch({ type: "page", scope: "more", page });
      } catch (error) {
        console.warn("[oltn] feed load more failed", error);
        if (token === tokenRef.current) dispatch({ type: "fail", scope: "more", error });
      }
    })();
  }, [state.loadingMore, state.hasMore, state.cursor]);

  const flushQueue = useCallback(() => {
    if (!queue.length) return;
    dispatch({ type: "prepend", items: queue });
    onFlushQueue?.();
  }, [queue, onFlushQueue]);

  // Auto mode queue: merges once the first page has arrived.
  useEffect(() => {
    if (queueMode !== "auto" || !enabled || !state.ready || state.loading) return;
    if (queue.length) dispatch({ type: "prepend", items: queue });
  }, [queue, queueMode, enabled, state.ready, state.loading]);

  const patch = useCallback((itemKey: string, itemPatch: Partial<T>) => {
    dispatch({ type: "patch", key: itemKey, patch: itemPatch });
  }, []);

  return {
    items: state.items,
    loading: state.loading,
    loadingMore: state.loadingMore,
    error: state.error,
    moreError: state.moreError,
    hasMore: state.hasMore,
    queue,
    reload: loadInitial,
    loadMore,
    flushQueue,
    patch,
  };
}
