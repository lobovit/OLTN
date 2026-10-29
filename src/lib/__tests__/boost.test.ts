import { describe, expect, it } from "vitest";
import type { Status } from "../../api/types";
import { canBoostStatus } from "../boost";

const status = (
  visibility: Status["visibility"],
  accountId = "2",
): Pick<Status, "visibility" | "account"> =>
  ({ visibility, account: { id: accountId } }) as Pick<Status, "visibility" | "account">;

describe("canBoostStatus", () => {
  it("never boosts direct posts, even your own", () => {
    expect(canBoostStatus(status("direct", "1"), "1")).toBe(false);
    expect(canBoostStatus(status("direct", "2"), "1")).toBe(false);
  });

  it("only lets you boost your own followers-only post", () => {
    expect(canBoostStatus(status("private", "1"), "1")).toBe(true);
    expect(canBoostStatus(status("private", "2"), "1")).toBe(false);
    expect(canBoostStatus(status("private", "1"), null)).toBe(false);
  });

  it("boosts public and unlisted posts", () => {
    expect(canBoostStatus(status("public"), "1")).toBe(true);
    expect(canBoostStatus(status("unlisted"), "1")).toBe(true);
  });
});
