import { beforeEach, describe, expect, it } from "vitest";
import type { Status } from "../../api/types";
import {
  putStatus,
  putStatuses,
  removeStatusById,
  statusKey,
  statusSourceById,
  store,
} from "../../state/store";

function status(id: string, uri: string): Status {
  return { id, uri } as unknown as Status;
}

describe("cached status sources", () => {
  beforeEach(() => {
    store.statuses = {};
    store.statusSources = {};
  });

  it("records the source instance when caching a status", () => {
    putStatus(status("1", "https://remote.example/users/a/statuses/1"), "my.instance");
    expect(store.statusSources["https://remote.example/users/a/statuses/1"]).toBe("my.instance");
    expect(statusSourceById("1")).toBe("my.instance");
  });

  it("propagates the source to the inner reblog", () => {
    const inner = status("2", "https://remote.example/users/b/statuses/2");
    const outer = {
      id: "3",
      uri: "https://other.example/users/c/statuses/3",
      reblog: inner,
    } as unknown as Status;
    putStatuses([outer], "my.instance");
    expect(store.statusSources[statusKey(inner)]).toBe("my.instance");
    expect(statusSourceById("2")).toBe("my.instance");
  });

  it("removes the source together with the status", () => {
    putStatus(status("1", "https://my.instance/users/a/statuses/1"), "my.instance");
    removeStatusById("my.instance", "1");
    expect(store.statuses).toEqual({});
    expect(store.statusSources).toEqual({});
  });
});
