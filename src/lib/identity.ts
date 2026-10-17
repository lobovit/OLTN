/* One place enforcing the cross-instance identity rules: a token is only
   valid on the account's instance, an id is only valid on the instance that
   produced it, and internal hrefs must point to the instance where the id
   exists. Read/link call sites consume this module instead of re-deriving
   the rules (see Phanpy-inspired client scoping in status actions). */

import { getRest } from "../api/client";
import type { Account, RestClient, Status } from "../api/types";
import { currentAccount, store } from "../state/store";

export interface ScopedClient {
  /** REST client for the instance (anonymous when the account is elsewhere). */
  client: RestClient;
  instance: string;
  /** True when the account token is attached (account belongs to this instance). */
  authed: boolean;
}

/** True when the given instance is the current account's instance. */
export function isOwnInstance(instance: string | undefined): boolean {
  const account = currentAccount();
  return !!account && account.instance === instance;
}

/** Token for the instance, only when the current account belongs to it. */
export function tokenFor(instance: string): string | undefined {
  const account = currentAccount();
  return account && account.instance === instance ? account.accessToken : undefined;
}

/** Scoped client for an instance; token selection happens only here. */
export function clientFor(instance: string): ScopedClient {
  const token = tokenFor(instance);
  return { client: getRest(instance, token), instance, authed: !!token };
}

/** The single builder of internal, instance-scoped routes. */
export const hrefFor = {
  status(id: string, sourceInstance: string): string {
    return `/${encodeURIComponent(sourceInstance)}/s/${id}`;
  },
  account(acct: string, fallbackHost: string): string {
    const [name, host] = acct.split("@");
    return `/${encodeURIComponent(host || fallbackHost)}/a/@${encodeURIComponent(name)}`;
  },
  /** Account page for an id that is valid on `instance` (always resolvable
      through the API of the instance that produced the data — unlike the
      acct-domain link, which needs that domain to expose the Mastodon API). */
  accountById(instance: string, id: string): string {
    return `/${encodeURIComponent(instance)}/a/${encodeURIComponent(id)}`;
  },
  tag(tag: string, host: string): string {
    return `/${encodeURIComponent(host)}/t/${encodeURIComponent(tag)}`;
  },
  /**
   * Converts a Mastodon URL path (post, account or tag) into an internal
   * route; returns null when the path is none of those.
   */
  fromExternalUrl(host: string, pathname: string): string | null {
    const clean = pathname.replace(/\/+$/, "");
    // hashtag: /tags/foo | /tag/foo
    const tag = clean.match(/^\/tags?\/([^/]+)$/);
    if (tag) return hrefFor.tag(tag[1], host);
    // status: /@user/123 | /users/user/statuses/123
    const status =
      clean.match(/^\/@[^/]+\/(\d+)$/) || clean.match(/^\/users\/[^/]+\/statuses\/(\d+)$/);
    if (status) return hrefFor.status(status[1], host);
    // account: /@user | /users/user
    const account = clean.match(/^\/@([^/]+)$/) || clean.match(/^\/users\/([^/]+)$/);
    if (account) return hrefFor.account(account[1], host);
    return null;
  },
};

/** Instance that originated a cached status (the id is only valid there). */
export function sourceInstanceFor(key: string, status: Status): string {
  const stored = store.statusSources[key];
  if (stored) return stored;
  try {
    return new URL(status.uri).host;
  } catch {
    return store.instance?.uri ?? "";
  }
}

/** Local status on the account instance (resolves when it came from another). */
export async function localStatus(
  client: RestClient,
  instance: string,
  status: Status,
  sourceInstance: string,
): Promise<Status | null> {
  if (sourceInstance === instance) return status;
  const query = status.uri || status.url;
  if (!query) return null;
  try {
    const result = await client.v2.search.list({
      q: query,
      resolve: true,
      type: "statuses",
      limit: 1,
    });
    return result.statuses.find((s) => s.uri === status.uri) ?? result.statuses[0] ?? null;
  } catch (err) {
    console.warn("[oltn] status resolve failed", err);
    return null;
  }
}

/** Id of an account on the account instance (resolves remote accounts). */
export async function localAccountId(
  client: RestClient,
  instance: string,
  account: Pick<Account, "id" | "acct">,
  sourceInstance: string,
): Promise<string | null> {
  if (sourceInstance === instance) return account.id;
  try {
    const result = await client.v2.search.list({
      q: account.acct,
      resolve: true,
      type: "accounts",
      limit: 1,
    });
    return result.accounts[0]?.id ?? null;
  } catch (err) {
    console.warn("[oltn] account resolve failed", err);
    return null;
  }
}

/** Resolves a full @user@host handle on the account instance (WebFinger via
    search). Only exact acct matches are accepted — no fuzzy suggestions. */
export async function resolveAccountHandle(
  client: RestClient,
  handle: string,
): Promise<Account | null> {
  const acct = handle.trim().replace(/^@/, "").toLowerCase();
  if (!acct.includes("@")) return null;
  try {
    const result = await client.v2.search.list({
      q: acct,
      resolve: true,
      type: "accounts",
      limit: 5,
    });
    return result.accounts.find((account) => account.acct.toLowerCase() === acct) ?? null;
  } catch (err) {
    console.warn("[oltn] account handle lookup failed", err);
    return null;
  }
}

/** Known accounts on the instance whose username matches a bare @handle
    (picks the source when the domain is not typed). */
export async function searchAccountsByUsername(
  client: RestClient,
  handle: string,
): Promise<Account[]> {
  const username = handle.trim().replace(/^@/, "").toLowerCase();
  if (!username || username.includes("@")) return [];
  try {
    const result = await client.v2.search.list({
      q: username,
      resolve: true,
      type: "accounts",
      limit: 10,
    });
    return result.accounts
      .filter((account) => account.username.toLowerCase() === username)
      .slice(0, 5);
  } catch (err) {
    console.warn("[oltn] account search failed", err);
    return [];
  }
}
