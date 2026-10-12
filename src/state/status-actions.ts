/* Status actions: mutation pipeline for statuses (boost, fav, bookmark,
   block, report, vote) behind an injected client — optimistic patch, local
   id resolution, call, rollback and toast in a single module. */

import type { Poll, RestClient, Status } from "../api/types";
import { t } from "../i18n/pt-BR";
import { userMessageForError } from "../lib/errors";
import { localAccountId, localStatus, sourceInstanceFor } from "../lib/identity";
import { patchStatus, putStatus, store, toast } from "./store";

export interface StatusActionsContext {
  /** REST client for the account instance (HTTP in production, fake in tests). */
  client: RestClient;
  /** Account instance — where the local id is valid. */
  instance: string;
}

export type ToggleAction = "boost" | "fav" | "bookmark";

/** One in-flight action per status+action; repeated clicks are ignored. */
const inFlight = new Set<string>();

function begin(key: string, action: string): boolean {
  const guard = `${key}:${action}`;
  if (inFlight.has(guard)) return false;
  inFlight.add(guard);
  return true;
}

function end(key: string, action: string): void {
  inFlight.delete(`${key}:${action}`);
}

/** Local status on the account instance (resolves when it came from another). */
async function resolveLocal(
  ctx: StatusActionsContext,
  key: string,
  status: Status,
): Promise<{ local: Status | null; source: string }> {
  const source = sourceInstanceFor(key, status);
  const local = await localStatus(ctx.client, ctx.instance, status, source);
  if (local && local !== status) putStatus(local, ctx.instance);
  return { local, source };
}

function optimisticPatch(status: Status, kind: ToggleAction): Partial<Status> {
  if (kind === "boost") {
    return {
      reblogsCount: Math.max(0, status.reblogsCount + (status.reblogged ? -1 : 1)),
      reblogged: !status.reblogged,
    };
  }
  if (kind === "fav") {
    return {
      favouritesCount: Math.max(0, status.favouritesCount + (status.favourited ? -1 : 1)),
      favourited: !status.favourited,
    };
  }
  return { bookmarked: !status.bookmarked };
}

function revertPatch(status: Status): Partial<Status> {
  return {
    reblogsCount: status.reblogsCount,
    reblogged: status.reblogged,
    favouritesCount: status.favouritesCount,
    favourited: status.favourited,
    bookmarked: status.bookmarked,
  };
}

/** Fav / boost / bookmark with optimistic update and rollback. */
export async function toggleStatusAction(
  ctx: StatusActionsContext,
  key: string,
  kind: ToggleAction,
): Promise<boolean> {
  const status = store.statuses[key];
  if (!status) return false;
  if (!begin(key, kind)) return false;
  const optimistic = optimisticPatch(status, kind);
  patchStatus(key, optimistic);
  const patched = store.statuses[key];
  try {
    const { local } = await resolveLocal(ctx, key, status);
    if (!local) throw new Error("status_resolve_failed");
    // Resolving a remote status replaces the cached entry with the server
    // copy; re-apply the optimistic patch so the in-flight state stays.
    if (store.statuses[key] !== patched) patchStatus(key, optimistic);
    const selected = ctx.client.v1.statuses.$select(local.id);
    // Save the server response (like Phanpy's saveStatus) so the cache is
    // authoritative; boosting returns the wrapper, unboosting the original.
    if (kind === "boost") {
      const updated = status.reblogged ? await selected.unreblog() : await selected.reblog();
      if (updated?.id) putStatus(updated as unknown as Status, ctx.instance);
    } else if (kind === "fav") {
      const updated = status.favourited ? await selected.unfavourite() : await selected.favourite();
      if (updated?.id) putStatus(updated as unknown as Status, ctx.instance);
    } else {
      const updated = status.bookmarked ? await selected.unbookmark() : await selected.bookmark();
      if (updated?.id) putStatus(updated as unknown as Status, ctx.instance);
    }
    // Boosts feeds (column/page) reload through this revision change.
    if (kind === "boost") store.ui.boostsRevision += 1;
    return true;
  } catch (err) {
    console.warn("[oltn] action failed", err);
    patchStatus(key, revertPatch(status));
    toast(userMessageForError(err, t.errorGeneric), "error");
    return false;
  } finally {
    end(key, kind);
  }
}

/** Blocks the status author and records the hiding invariant. */
export async function blockStatusAuthor(ctx: StatusActionsContext, key: string): Promise<boolean> {
  const status = store.statuses[key];
  if (!status) return false;
  if (!begin(key, "block")) return false;
  try {
    const source = sourceInstanceFor(key, status);
    const accountId = await localAccountId(ctx.client, ctx.instance, status.account, source);
    if (!accountId) throw new Error("block_resolve_failed");
    await ctx.client.v1.accounts.$select(accountId).block();
    const acct = status.account.acct;
    if (!store.blockedAccounts.includes(acct)) {
      store.blockedAccounts = [...store.blockedAccounts, acct];
    }
    toast(t.blocked, "ok");
    return true;
  } catch (err) {
    console.warn("[oltn] block failed", err);
    toast(userMessageForError(err, t.errorGeneric), "error");
    return false;
  } finally {
    end(key, "block");
  }
}

/** Reports the status (with optional comment). */
export async function reportStatus(
  ctx: StatusActionsContext,
  key: string,
  comment: string,
): Promise<boolean> {
  const status = store.statuses[key];
  if (!status) return false;
  if (!begin(key, "report")) return false;
  try {
    const source = sourceInstanceFor(key, status);
    const [local, accountId] = await Promise.all([
      localStatus(ctx.client, ctx.instance, status, source),
      localAccountId(ctx.client, ctx.instance, status.account, source),
    ]);
    if (!local || !accountId) throw new Error("report_resolve_failed");
    await ctx.client.v1.reports.create({
      accountId,
      statusIds: [local.id],
      comment: comment.trim() || undefined,
    });
    toast(t.reportSent, "ok");
    return true;
  } catch (err) {
    console.warn("[oltn] report failed", err);
    toast(userMessageForError(err, t.errorGeneric), "error");
    return false;
  } finally {
    end(key, "report");
  }
}

/** Votes on the status poll (once, unless multiple choice). */
export async function votePoll(
  ctx: StatusActionsContext,
  key: string,
  choice: number,
): Promise<boolean> {
  const poll = store.statuses[key]?.poll;
  if (!poll) return false;
  if (!poll.multiple && poll.voted) return false;
  if (!begin(key, "vote")) return false;
  try {
    const updated = await ctx.client.v1.polls.$select(poll.id).votes.create({ choices: [choice] });
    patchStatus(key, { poll: updated as unknown as Poll });
    return true;
  } catch (err) {
    console.warn("[oltn] vote failed", err);
    toast(userMessageForError(err, t.errorGeneric), "error");
    return false;
  } finally {
    end(key, "vote");
  }
}
