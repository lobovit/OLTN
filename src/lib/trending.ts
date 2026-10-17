/* Pure ranking helpers for the trending views. */

import type { Account, Status } from "../api/types";

export interface TrendingAuthor {
  account: Account;
  count: number;
}

export interface TrendBucket {
  day: string;
  uses?: string | null;
}

/** Total posts that used the tag/link across the trend window. */
export function trendTotalUses(history: readonly TrendBucket[]): number {
  return history.reduce((total, entry) => total + Number(entry.uses || 0), 0);
}

/** Ranks the authors behind trending posts (boosts credit the boosted author). */
export function rankTrendingAuthors(statuses: readonly Status[], limit = 12): TrendingAuthor[] {
  const byId = new Map<string, TrendingAuthor>();
  for (const status of statuses) {
    const account = status.reblog?.account ?? status.account;
    const entry = byId.get(account.id);
    if (entry) entry.count += 1;
    else byId.set(account.id, { account, count: 1 });
  }
  return [...byId.values()]
    .sort(
      (a, b) =>
        b.count - a.count ||
        b.account.followersCount - a.account.followersCount ||
        a.account.acct.localeCompare(b.account.acct),
    )
    .slice(0, limit);
}
