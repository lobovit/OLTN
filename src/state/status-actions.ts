/* Status actions: mutation pipeline for statuses (boost, fav, bookmark,
   block, report, vote) behind an injected client — optimistic patch, local
   id resolution, call, rollback and toast in a single module. */

import type { ReportCategory, RestClient, Status } from "../api/types";
import { t } from "../i18n/pt-BR";
import { userMessageForError } from "../lib/errors";
import { localAccountId, localStatus, sourceInstanceFor } from "../lib/identity";
import { patchStatus, putStatus, removeStatusById, store, toast } from "./store";

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

/** Single API call for the toggle kind; returns the cached-worthy response. */
async function callToggle(
  statuses: RestClient["v1"]["statuses"],
  localId: string,
  status: Status,
  kind: ToggleAction,
): Promise<Status | null> {
  const selected = statuses.$select(localId);
  const updated =
    kind === "boost"
      ? status.reblogged
        ? await selected.unreblog()
        : await selected.reblog()
      : kind === "fav"
        ? status.favourited
          ? await selected.unfavourite()
          : await selected.favourite()
        : status.bookmarked
          ? await selected.unbookmark()
          : await selected.bookmark();
  return updated?.id ? updated : null;
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
    // Save the server response (like Phanpy's saveStatus) so the cache is
    // authoritative; boosting returns the wrapper, unboosting the original.
    const updated = await callToggle(ctx.client.v1.statuses, local.id, status, kind);
    if (updated) putStatus(updated, ctx.instance);
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

/** Pins or unpins the status at the top of the author's profile. */
export async function toggleStatusPin(ctx: StatusActionsContext, key: string): Promise<boolean> {
  const status = store.statuses[key];
  if (!status) return false;
  if (!begin(key, "pin")) return false;
  try {
    const { local } = await resolveLocal(ctx, key, status);
    if (!local) throw new Error("pin_resolve_failed");
    const pinned = local.pinned ?? status.pinned ?? false;
    const selected = ctx.client.v1.statuses.$select(local.id);
    const updated = pinned ? await selected.unpin() : await selected.pin();
    putStatus(updated, ctx.instance);
    store.ui.pinsRevision += 1;
    toast(updated.pinned === true ? t.postPinned : t.postUnpinned, "ok");
    return true;
  } catch (err) {
    console.warn("[oltn] pin failed", err);
    toast(userMessageForError(err, t.errorGeneric), "error");
    return false;
  } finally {
    end(key, "pin");
  }
}

/** Deletes the status on the account instance (resolving the local copy first). */
export async function deleteStatus(ctx: StatusActionsContext, key: string): Promise<boolean> {
  const status = store.statuses[key];
  if (!status) return false;
  if (!begin(key, "delete")) return false;
  try {
    const { local } = await resolveLocal(ctx, key, status);
    if (!local) throw new Error("delete_resolve_failed");
    await ctx.client.v1.statuses.$select(local.id).remove();
    removeStatusById(ctx.instance, local.id);
    // Copies fetched from another instance are keyed by uri; drop them too so
    // every rendered card of the deleted post disappears.
    if (status.uri) {
      for (const [cachedKey, cached] of Object.entries(store.statuses)) {
        if (cached.uri === status.uri) {
          delete store.statuses[cachedKey];
          delete store.statusSources[cachedKey];
        }
      }
    }
    toast(t.postDeleted, "ok");
    return true;
  } catch (err) {
    console.warn("[oltn] delete failed", err);
    toast(userMessageForError(err, t.errorGeneric), "error");
    return false;
  } finally {
    end(key, "delete");
  }
}

/** Blocks the account on the instance and records the hiding invariant. */
async function applyBlock(
  ctx: StatusActionsContext,
  accountId: string,
  acct: string,
): Promise<void> {
  await ctx.client.v1.accounts.$select(accountId).block();
  if (!store.blockedAccounts.includes(acct)) {
    store.blockedAccounts = [...store.blockedAccounts, acct];
  }
  toast(t.blocked, "ok");
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
    await applyBlock(ctx, accountId, status.account.acct);
    return true;
  } catch (err) {
    console.warn("[oltn] block failed", err);
    toast(userMessageForError(err, t.errorGeneric), "error");
    return false;
  } finally {
    end(key, "block");
  }
}

export interface ReportOptions {
  comment?: string;
  /** Mastodon report category (spam, legal, violation, other). */
  category?: ReportCategory;
  /** Instance rule ids cited as violated (implies the `violation` category). */
  ruleIds?: readonly string[];
  /** Forward the report to the account's remote instance. */
  forward?: boolean;
  /** Extra action applied together with the report. */
  also?: "mute" | "block";
}

/** Reports the status with the selected options. */
export async function reportStatus(
  ctx: StatusActionsContext,
  key: string,
  options: ReportOptions = {},
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
    const ruleIds = (options.ruleIds ?? []).filter(Boolean);
    await ctx.client.v1.reports.create({
      accountId,
      statusIds: [local.id],
      comment: options.comment?.trim() || undefined,
      category: options.category ?? undefined,
      ruleIds: ruleIds.length ? ruleIds : undefined,
      forward: options.forward || undefined,
    });
    if (options.also === "mute") {
      await ctx.client.v1.accounts.$select(accountId).mute();
      toast(t.muted, "ok");
    }
    if (options.also === "block") {
      await applyBlock(ctx, accountId, status.account.acct);
    }
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
    patchStatus(key, { poll: updated });
    return true;
  } catch (err) {
    console.warn("[oltn] vote failed", err);
    toast(userMessageForError(err, t.errorGeneric), "error");
    return false;
  } finally {
    end(key, "vote");
  }
}
