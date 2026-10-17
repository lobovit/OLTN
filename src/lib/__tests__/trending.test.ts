import { describe, expect, it } from "vitest";
import type { Status } from "../../api/types";
import { rankTrendingAuthors, trendTotalUses } from "../trending";

function account(id: string, acct: string, followers = 0) {
  return {
    id,
    acct,
    username: acct.split("@")[0],
    displayName: acct,
    avatar: "",
    avatarStatic: "",
    emojis: [],
    followersCount: followers,
  };
}

function status(
  id: string,
  author: ReturnType<typeof account>,
  reblog?: ReturnType<typeof account>,
) {
  return {
    id,
    uri: `https://mock.instance/users/u/statuses/${id}`,
    account: author,
    reblog: reblog
      ? { id: `r${id}`, uri: `https://mock.instance/boosts/${id}`, account: reblog }
      : null,
  } as unknown as Status;
}

describe("rankTrendingAuthors", () => {
  it("counts posts per author, most active first", () => {
    const a = account("1", "a@mock.instance");
    const b = account("2", "b@mock.instance");
    const ranked = rankTrendingAuthors([
      status("1", a),
      status("2", b),
      status("3", a),
      status("4", a),
    ]);
    expect(ranked.map((entry) => [entry.account.id, entry.count])).toEqual([
      ["1", 3],
      ["2", 1],
    ]);
  });

  it("credits the boosted author, not the booster", () => {
    const author = account("1", "author@mock.instance");
    const booster = account("9", "booster@mock.instance");
    const ranked = rankTrendingAuthors([status("1", booster, author)]);
    expect(ranked[0].account.id).toBe("1");
  });

  it("breaks ties by followers, then handle", () => {
    const few = account("1", "few@mock.instance", 10);
    const many = account("2", "many@mock.instance", 900);
    const ranked = rankTrendingAuthors([status("1", few), status("2", many)]);
    expect(ranked.map((entry) => entry.account.id)).toEqual(["2", "1"]);

    const alpha = account("3", "alpha@mock.instance", 10);
    const beta = account("4", "beta@mock.instance", 10);
    const tie = rankTrendingAuthors([status("5", beta), status("6", alpha)]);
    expect(tie.map((entry) => entry.account.id)).toEqual(["3", "4"]);
  });

  it("caps the list at the limit", () => {
    const statuses = Array.from({ length: 20 }, (_, index) =>
      status(String(index), account(String(index), `u${index}@mock.instance`, index)),
    );
    expect(rankTrendingAuthors(statuses, 5)).toHaveLength(5);
  });
});

describe("trendTotalUses", () => {
  it("sums the daily uses into one number", () => {
    expect(
      trendTotalUses([
        { day: "1", uses: "3" },
        { day: "2", uses: "7" },
      ]),
    ).toBe(10);
  });

  it("treats missing uses as zero", () => {
    expect(trendTotalUses([{ day: "1" }, { day: "2", uses: null }])).toBe(0);
  });
});
