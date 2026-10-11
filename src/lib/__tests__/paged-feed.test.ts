import { describe, expect, it } from "vitest";
import {
  feedReducer,
  initialFeedState,
  type FeedAdapter,
  type FeedEvent,
  type FeedPage,
  type FeedState,
} from "../paged-feed";

interface Item {
  id: string;
  text?: string;
}

const adapter: Pick<FeedAdapter<Item>, "keyOf" | "cursorOf"> = {
  keyOf: (item) => item.id,
  cursorOf: (item) => item.id,
};

const page = (ids: string[], hasMore = false): FeedPage<Item> => ({
  items: ids.map((id) => ({ id })),
  hasMore,
});

function stateAfter(events: FeedEvent<Item>[]): FeedState<Item> {
  return events.reduce<FeedState<Item>>(
    (state, event) => feedReducer(state, event, adapter),
    initialFeedState<Item>(),
  );
}

const ids = (state: FeedState<Item>): string[] => state.items.map((item) => item.id);

describe("paged feed", () => {
  it("first page sets items, cursor, hasMore and ready", () => {
    const state = stateAfter([
      { type: "start", scope: "initial" },
      { type: "page", scope: "initial", page: page(["1", "2", "3"], true) },
    ]);
    expect(ids(state)).toEqual(["1", "2", "3"]);
    expect(state.cursor).toBe("3");
    expect(state.hasMore).toBe(true);
    expect(state.ready).toBe(true);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it("dedupe within the page itself", () => {
    const state = stateAfter([{ type: "page", scope: "initial", page: page(["1", "1", "2"]) }]);
    expect(ids(state)).toEqual(["1", "2"]);
    expect(state.hasMore).toBe(false);
  });

  it("load more adds only new items and advances the cursor", () => {
    const state = stateAfter([
      { type: "page", scope: "initial", page: page(["1", "2"], true) },
      { type: "start", scope: "more" },
      { type: "page", scope: "more", page: page(["2", "3"], false) },
    ]);
    expect(ids(state)).toEqual(["1", "2", "3"]);
    expect(state.cursor).toBe("3");
    expect(state.hasMore).toBe(false);
    expect(state.loadingMore).toBe(false);
  });

  it("prepend (fila) deduplica contra a lista e dentro da fila", () => {
    const state = stateAfter([
      { type: "page", scope: "initial", page: page(["2", "3"]) },
      { type: "prepend", items: [{ id: "1" }, { id: "2" }, { id: "1" }] },
    ]);
    expect(ids(state)).toEqual(["1", "2", "3"]);
  });

  it("failure before any page keeps ready false and no items", () => {
    const state = stateAfter([
      { type: "start", scope: "initial" },
      { type: "fail", scope: "initial", error: new Error("boom") },
    ]);
    expect(state.items).toEqual([]);
    expect(state.error).toBeInstanceOf(Error);
    expect(state.loading).toBe(false);
    expect(state.ready).toBe(false);
  });

  it("reloading keeps old items when the new page fails", () => {
    const state = stateAfter([
      { type: "page", scope: "initial", page: page(["1"]) },
      { type: "start", scope: "initial" },
      { type: "fail", scope: "initial", error: new Error("boom") },
    ]);
    expect(ids(state)).toEqual(["1"]);
    expect(state.error).toBeInstanceOf(Error);
  });

  it("reloading replaces the list instead of dropping repeated items", () => {
    const state = stateAfter([
      { type: "page", scope: "initial", page: page(["1", "2"]) },
      { type: "start", scope: "initial" },
      { type: "page", scope: "initial", page: page(["9", "1"]) },
    ]);
    expect(ids(state)).toEqual(["9", "1"]);
  });

  it("pagination error stays in moreError without hiding the list", () => {
    const state = stateAfter([
      { type: "page", scope: "initial", page: page(["1"], true) },
      { type: "start", scope: "more" },
      { type: "fail", scope: "more", error: new Error("page 2") },
    ]);
    expect(state.error).toBeNull();
    expect(state.moreError).toBeInstanceOf(Error);
    expect(ids(state)).toEqual(["1"]);
    expect(state.hasMore).toBe(true);
  });

  it("start clears the error of the matching scope", () => {
    const failed = stateAfter([{ type: "fail", scope: "initial", error: new Error("x") }]);
    const retried = feedReducer(failed, { type: "start", scope: "initial" }, adapter);
    expect(retried.error).toBeNull();
    expect(retried.loading).toBe(true);
  });

  it("patch updates one item without touching the others", () => {
    const state = stateAfter([
      { type: "page", scope: "initial", page: page(["1", "2"]) },
      { type: "patch", key: "2", patch: { text: "lida" } },
    ]);
    expect(state.items[0].text).toBeUndefined();
    expect(state.items[1].text).toBe("lida");
  });
});
