import { describe, expect, it } from "vitest";
import type { Status } from "../../api/types";
import { statusShareLink } from "../share";

const status = (over: Partial<Pick<Status, "url" | "uri">>): Pick<Status, "url" | "uri"> =>
  over as Pick<Status, "url" | "uri">;

describe("statusShareLink", () => {
  it("prefers the canonical web url", () => {
    expect(
      statusShareLink(
        status({ url: "https://remote.example/@u/1", uri: "https://ap.example/1" }),
        "fallback",
      ),
    ).toBe("https://remote.example/@u/1");
  });

  it("falls back to the ActivityPub uri", () => {
    expect(statusShareLink(status({ url: null, uri: "https://ap.example/1" }), "fallback")).toBe(
      "https://ap.example/1",
    );
  });

  it("uses the given in-app link when neither exists", () => {
    expect(statusShareLink(status({ url: null, uri: "" }), "app-link")).toBe("app-link");
  });
});
