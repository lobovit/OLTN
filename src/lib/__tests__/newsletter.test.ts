import { describe, expect, it } from "vitest";
import type { Status } from "../../api/types";
import { newestFirst } from "../newsletter";

function status(id: string, createdAt: string): Status {
  return {
    id,
    uri: `https://mock.example/users/u/statuses/${id}`,
    createdAt,
  } as unknown as Status;
}

describe("newestFirst", () => {
  it("merges lists ordered by date, newest first", () => {
    const result = newestFirst([
      [status("1", "2026-01-01T10:00:00Z"), status("3", "2026-01-01T12:00:00Z")],
      [status("2", "2026-01-01T11:00:00Z")],
    ]);
    expect(result.map((item) => item.id)).toEqual(["3", "2", "1"]);
  });

  it("drops duplicated statuses across lists", () => {
    const same = status("1", "2026-01-01T10:00:00Z");
    expect(newestFirst([[same], [{ ...same }]])).toHaveLength(1);
  });

  it("caps the merged list", () => {
    const list = [status("1", "2026-01-01T10:00:00Z"), status("2", "2026-01-01T11:00:00Z")];
    expect(newestFirst([list], 1).map((item) => item.id)).toEqual(["2"]);
  });
});
