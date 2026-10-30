import { describe, expect, it } from "vitest";
import type { RestClient } from "../../api/types";
import { fetchStatusPage } from "../../components/feed/timeline-fetch";

function clientWithHome(calls: Record<string, unknown>[]): RestClient {
  return {
    v1: {
      timelines: {
        home: {
          list: async (params: Record<string, unknown>) => {
            calls.push(params);
            return [];
          },
        },
      },
    },
  } as unknown as RestClient;
}

describe("fetchStatusPage", () => {
  it("asks the API for media-only home pages", async () => {
    const calls: Record<string, unknown>[] = [];
    await fetchStatusPage({ type: "home", onlyMedia: true }, 30, null, {
      client: clientWithHome(calls),
      instance: "example.test",
    });
    expect(calls).toEqual([{ limit: 30, maxId: undefined, onlyMedia: true }]);
  });

  it("keeps the regular home timeline unfiltered", async () => {
    const calls: Record<string, unknown>[] = [];
    await fetchStatusPage({ type: "home" }, 20, "42", {
      client: clientWithHome(calls),
      instance: "example.test",
    });
    expect(calls).toEqual([{ limit: 20, maxId: "42", onlyMedia: false }]);
  });
});
