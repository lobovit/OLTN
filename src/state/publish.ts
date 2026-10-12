/* Publish plan executor: converts code blocks into images, publishes part by
   part through the injected client and returns what is left on failure. */

import type { RestClient, Status } from "../api/types";
import { t } from "../i18n/pt-BR";
import { codeBlockToImageFile, type CodeBlock } from "../lib/code-image";
import {
  buildPublishExecution,
  type PublishExecution,
  type PublishPart,
  type PublishPlan,
} from "../lib/publish-plan";
import { putStatus, store, toast } from "./store";

export interface PublishContext {
  /** REST client for the account instance (HTTP in production, fake in tests). */
  client: RestClient;
  /** Instance where the published status is valid. */
  instance: string;
}

export interface PublishOutcome {
  ok: boolean;
  kind: PublishExecution["kind"];
  posted: Status[];
  /** Unpublished parts, to return to the editor. */
  remaining: string[];
  error?: unknown;
}

async function convertCodeBlocks(
  ctx: PublishContext,
  plan: PublishPlan,
): Promise<{ converted: CodeBlock[]; mediaIds: string[] }> {
  const converted: CodeBlock[] = [];
  const mediaIds: string[] = [];
  for (const block of plan.blocks) {
    try {
      const file = await codeBlockToImageFile(block);
      if (!file) throw new Error("code_render_failed");
      const attachment = await ctx.client.v1.media.create({
        file,
        description: block.code,
      });
      converted.push(block);
      mediaIds.push(attachment.id);
    } catch (err) {
      console.warn("[oltn] code image failed", err);
      toast(t.codeImageFailed, "error");
    }
  }
  return { converted, mediaIds };
}

async function updateStatus(
  ctx: PublishContext,
  execution: PublishExecution,
  statusId: string,
): Promise<Status> {
  const part = execution.parts[0];
  const selected = ctx.client.v1.statuses.$select(statusId);
  const status = part.mediaIds.length
    ? await selected.update({
        status: part.status,
        spoilerText: part.spoilerText,
        visibility: execution.visibility,
        sensitive: execution.sensitive,
        mediaIds: part.mediaIds,
        mediaAttributes: part.mediaAttributes,
        quoteApprovalPolicy: part.quoteApprovalPolicy,
      })
    : await selected.update({
        status: part.status,
        spoilerText: part.spoilerText,
        visibility: execution.visibility,
        sensitive: execution.sensitive,
        poll: part.poll,
        quoteApprovalPolicy: part.quoteApprovalPolicy,
      });
  store.ui.lastPostedKey = putStatus(status, ctx.instance);
  return status;
}

async function scheduleStatus(ctx: PublishContext, execution: PublishExecution): Promise<void> {
  const part = execution.parts[0];
  const common = {
    spoilerText: part.spoilerText,
    visibility: execution.visibility,
    sensitive: execution.sensitive,
    inReplyToId: part.inReplyToId,
    quotedStatusId: part.quotedStatusId,
    quoteApprovalPolicy: part.quoteApprovalPolicy,
    scheduledAt: execution.scheduledAt,
  };
  if (part.mediaIds.length) {
    await ctx.client.v1.statuses.create({
      ...common,
      status: part.status || undefined,
      mediaIds: part.mediaIds,
    });
    return;
  }
  await ctx.client.v1.statuses.create({ ...common, status: part.status, poll: part.poll });
}

/** Publishes one thread part and caches it (quote/poll are first-part only). */
async function createStatus(
  ctx: PublishContext,
  execution: PublishExecution,
  part: PublishPart,
  replyToId?: string,
): Promise<Status> {
  const status = part.mediaIds.length
    ? await ctx.client.v1.statuses.create({
        status: part.status || undefined,
        spoilerText: part.spoilerText,
        visibility: execution.visibility,
        mediaIds: part.mediaIds,
        inReplyToId: replyToId,
        quotedStatusId: part.quotedStatusId,
        quoteApprovalPolicy: part.quoteApprovalPolicy,
      })
    : await ctx.client.v1.statuses.create({
        status: part.status,
        spoilerText: part.spoilerText,
        visibility: execution.visibility,
        poll: part.poll,
        inReplyToId: replyToId,
        quotedStatusId: part.quotedStatusId,
        quoteApprovalPolicy: part.quoteApprovalPolicy,
      });
  store.ui.lastPostedKey = putStatus(status, ctx.instance);
  return status;
}

/** Runs the plan; never throws — failures become `ok: false` + `remaining`. */
export async function executePublish(
  ctx: PublishContext,
  plan: PublishPlan,
): Promise<PublishOutcome> {
  const { converted, mediaIds: generatedIds } = await convertCodeBlocks(ctx, plan);
  const execution = buildPublishExecution(plan, converted, generatedIds);
  const posted: Status[] = [];

  try {
    if (execution.kind === "update" && execution.statusId) {
      posted.push(await updateStatus(ctx, execution, execution.statusId));
      return { ok: true, kind: "update", posted, remaining: [] };
    }

    if (execution.kind === "schedule") {
      await scheduleStatus(ctx, execution);
      return { ok: true, kind: "schedule", posted, remaining: [] };
    }

    // create: chains thread parts as replies.
    let replyToId = execution.parts[0]?.inReplyToId;
    for (const part of execution.parts) {
      const status = await createStatus(ctx, execution, part, replyToId);
      posted.push(status);
      replyToId = status.id;
    }
    return { ok: true, kind: "create", posted, remaining: [] };
  } catch (error) {
    console.warn("[oltn] publish failed", error, `${posted.length}/${execution.parts.length}`);
    return {
      ok: false,
      kind: execution.kind,
      posted,
      remaining: posted.length
        ? execution.parts.slice(posted.length).map((part) => part.status)
        : [],
      error,
    };
  }
}
