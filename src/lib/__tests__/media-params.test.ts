import { describe, expect, it } from "vitest";
import { mediaCreateParams } from "../media-params";

const file = new File(["x"], "photo.jpg", { type: "image/jpeg" });

describe("mediaCreateParams", () => {
  it("omits the description key when there is nothing to send", () => {
    expect("description" in mediaCreateParams(file, undefined)).toBe(false);
    expect("description" in mediaCreateParams(file, "")).toBe(false);
    expect("description" in mediaCreateParams(file, "   ")).toBe(false);
  });

  it("trims the description when given", () => {
    expect(mediaCreateParams(file, "  Sunset over the bay  ").description).toBe(
      "Sunset over the bay",
    );
  });
});
