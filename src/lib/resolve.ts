/* Resolves local entities (on the account instance) for posts/accounts seen
   from another instance — ids are only valid where they originated. */

import type { Account, RestClient, Status } from "../api/types";

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
