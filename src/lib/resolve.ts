/* Resolve entidades locais (na instância da conta) de posts/contas vistas
   a partir de outra instância — os ids só valem onde foram originados. */

import { getRest } from "../api/client";
import type { Account, Status } from "../api/types";

export async function localStatus(
  instance: string,
  accessToken: string | undefined,
  status: Status,
  sourceInstance: string,
): Promise<Status | null> {
  if (sourceInstance === instance) return status;
  const query = status.uri || status.url;
  if (!query) return null;
  try {
    const result = await getRest(instance, accessToken).v2.search.list({
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
  instance: string,
  accessToken: string | undefined,
  account: Pick<Account, "id" | "acct">,
  sourceInstance: string,
): Promise<string | null> {
  if (sourceInstance === instance) return account.id;
  try {
    const result = await getRest(instance, accessToken).v2.search.list({
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
