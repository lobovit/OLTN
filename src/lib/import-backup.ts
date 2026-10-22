import type { Account, RestClient } from "../api/types";
import type { Backup } from "./backup";
import { httpStatusOf } from "./errors";

export type ImportPhase = "following" | "lists" | "filters" | "mutes" | "blocks" | "domains";

export interface ImportProgress {
  phase: ImportPhase;
  done: number;
  total: number;
}

export interface ImportSummary {
  followed: number;
  lists: number;
  filters: number;
  mutes: number;
  blocks: number;
  domains: number;
  skipped: number;
}

export interface ImportOptions {
  onProgress?: (progress: ImportProgress) => void;
  isCancelled?: () => boolean;
}

/** Small pause between mutations to stay friendly with instance rate limits. */
const STEP_DELAY = 300;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/** Runs a request, waiting once for a 429 reset window; null on failure. */
async function attempt<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    if (httpStatusOf(err) !== 429) return null;
    await sleep(15_000);
    try {
      return await fn();
    } catch {
      return null;
    }
  }
}

async function resolveAccount(client: RestClient, handle: string): Promise<Account | null> {
  return attempt(async () => {
    const result = await client.v2.search.list({
      q: handle,
      resolve: true,
      type: "accounts",
      limit: 5,
    });
    return result.accounts.find((account) => account.acct.toLowerCase() === handle) ?? null;
  });
}

/** Recreates the portable account data from an OLTN backup on the current instance. */
export async function importAccountData(
  client: RestClient,
  backup: Backup,
  options: ImportOptions = {},
): Promise<ImportSummary> {
  const { onProgress, isCancelled } = options;
  const summary: ImportSummary = {
    followed: 0,
    lists: 0,
    filters: 0,
    mutes: 0,
    blocks: 0,
    domains: 0,
    skipped: 0,
  };
  const resolved = new Map<string, Account>();
  const cancelled = (): boolean => isCancelled?.() === true;

  const find = async (handle: string): Promise<Account | null> => {
    const cached = resolved.get(handle);
    if (cached) return cached;
    const account = await resolveAccount(client, handle);
    if (account) resolved.set(handle, account);
    return account;
  };

  for (const [index, handle] of backup.following.entries()) {
    if (cancelled()) return summary;
    const account = await find(handle);
    if (!account) {
      summary.skipped++;
    } else {
      const followed = await attempt(() => client.v1.accounts.$select(account.id).follow());
      if (followed) summary.followed++;
      else summary.skipped++;
    }
    onProgress?.({ phase: "following", done: index + 1, total: backup.following.length });
    await sleep(STEP_DELAY);
  }

  for (const [index, list] of backup.lists.entries()) {
    if (cancelled()) return summary;
    const created = await attempt(() => client.v1.lists.create({ title: list.title }));
    if (!created) {
      summary.skipped++;
    } else {
      const ids: string[] = [];
      for (const handle of list.accounts) {
        const account = await find(handle);
        if (account) ids.push(account.id);
        else summary.skipped++;
        await sleep(STEP_DELAY);
      }
      const added = ids.length
        ? await attempt(() =>
            client.v1.lists.$select(created.id).accounts.create({ accountIds: ids }),
          )
        : true;
      if (added) summary.lists++;
      else summary.skipped += ids.length;
    }
    onProgress?.({ phase: "lists", done: index + 1, total: backup.lists.length });
    await sleep(STEP_DELAY);
  }

  for (const [index, filter] of backup.filters.entries()) {
    if (cancelled()) return summary;
    const created = await attempt(() =>
      client.v2.filters.create({
        title: filter.title,
        context: filter.context.length ? filter.context : ["home"],
        filterAction: filter.action,
        keywordsAttributes: filter.keywords.length ? filter.keywords : null,
      }),
    );
    if (created) summary.filters++;
    else summary.skipped++;
    onProgress?.({ phase: "filters", done: index + 1, total: backup.filters.length });
    await sleep(STEP_DELAY);
  }

  for (const [index, handle] of backup.mutes.entries()) {
    if (cancelled()) return summary;
    const account = await find(handle);
    const muted = account
      ? await attempt(() => client.v1.accounts.$select(account.id).mute())
      : null;
    if (muted) summary.mutes++;
    else summary.skipped++;
    onProgress?.({ phase: "mutes", done: index + 1, total: backup.mutes.length });
    await sleep(STEP_DELAY);
  }

  for (const [index, handle] of backup.blocks.entries()) {
    if (cancelled()) return summary;
    const account = await find(handle);
    const blocked = account
      ? await attempt(() => client.v1.accounts.$select(account.id).block())
      : null;
    if (blocked) summary.blocks++;
    else summary.skipped++;
    onProgress?.({ phase: "blocks", done: index + 1, total: backup.blocks.length });
    await sleep(STEP_DELAY);
  }

  for (const [index, domain] of backup.domainBlocks.entries()) {
    if (cancelled()) return summary;
    const blocked = await attempt(() => client.v1.domainBlocks.create({ domain }));
    if (blocked === null) summary.skipped++;
    else summary.domains++;
    onProgress?.({ phase: "domains", done: index + 1, total: backup.domainBlocks.length });
    await sleep(STEP_DELAY);
  }

  return summary;
}
