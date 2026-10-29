/* Pure publish plan: draft + limits → what will be published.
   Code-to-image conversion, upload and API calls live in the executor. */

import type { ComposeVisibility, MediaAttachment, StatusVisibility } from "../api/types";
import { extractCodeBlocks, type CodeBlock } from "./code-image";
import { splitThreadText } from "./thread";

export interface PublishLimits {
  charLimit: number;
  maxMedia: number;
}

export interface PublishPoll {
  options: string[];
  expiresIn: number;
  multiple: boolean;
}

/** Quote approval policy (Mastodon 4.5+). Ignored for private/direct posts. */
export type QuotePolicy = "public" | "followers" | "nobody";

export interface ComposeDraft {
  text: string;
  spoiler: string;
  showCw: boolean;
  visibility: ComposeVisibility;
  sensitive: boolean;
  poll?: PublishPoll;
  /** Attachments already uploaded by the sheet's interactive uploader. */
  media: MediaAttachment[];
  replyToId?: string;
  quoteId?: string;
  quotePolicy?: QuotePolicy;
  /** ISO timestamp — present when the post will be scheduled. */
  scheduledAt?: string;
}

export interface PublishIntent {
  mode: "new" | "reply" | "quote" | "edit";
  statusId?: string;
}

export interface PublishPlan {
  mode: PublishIntent["mode"];
  limits: PublishLimits;
  editStatusId?: string;
  scheduledAt?: string;
  visibility: StatusVisibility;
  sensitive: boolean;
  /** CW applied to the first part only. */
  spoilerText: string | null;
  poll?: PublishPoll;
  media: MediaAttachment[];
  rootReplyToId?: string;
  quoteId?: string;
  quotePolicy?: QuotePolicy;
  /** Blocks the executor should convert into the free media slots. */
  blocks: CodeBlock[];
  text: string;
}

/** Decides what to publish without touching DOM, network or store. */
export function planPublish(
  draft: ComposeDraft,
  limits: PublishLimits,
  intent: PublishIntent,
): PublishPlan {
  const text = draft.text.trim();
  const isEdit = intent.mode === "edit";
  const poll = draft.poll && draft.poll.options.length ? draft.poll : undefined;
  const freeSlots = Math.max(0, limits.maxMedia - draft.media.length);
  // Code only becomes an image without a poll and not editing; respects free slots.
  const blocks = isEdit || poll ? [] : extractCodeBlocks(text).slice(0, freeSlots);
  const quotePolicy =
    draft.visibility === "private" || draft.visibility === "direct" ? "nobody" : draft.quotePolicy;
  return {
    mode: intent.mode,
    limits,
    editStatusId: isEdit ? intent.statusId : undefined,
    scheduledAt: draft.scheduledAt,
    visibility: draft.visibility as StatusVisibility,
    sensitive: draft.sensitive,
    spoilerText: draft.showCw ? draft.spoiler : null,
    poll,
    media: draft.media,
    rootReplyToId: draft.replyToId,
    quoteId: draft.quoteId,
    quotePolicy,
    blocks,
    text,
  };
}

export interface PublishPart {
  status: string;
  spoilerText: string | null;
  mediaIds: string[];
  mediaAttributes?: { id: string; description: string | null }[];
  poll?: PublishPoll;
  inReplyToId?: string;
  quotedStatusId?: string;
  quoteApprovalPolicy?: QuotePolicy;
}

export interface PublishExecution {
  kind: "create" | "update" | "schedule";
  statusId?: string;
  scheduledAt?: string;
  visibility: StatusVisibility;
  sensitive: boolean;
  parts: PublishPart[];
}

/** Materializes the plan after knowing which blocks converted. */
export function buildPublishExecution(
  plan: PublishPlan,
  convertedBlocks: readonly CodeBlock[],
  generatedMediaIds: readonly string[],
): PublishExecution {
  const converted = new Set(convertedBlocks.map((block) => block.raw));
  let text = plan.text;
  let removed = false;
  for (const block of plan.blocks) {
    if (converted.has(block.raw) && text.includes(block.raw)) {
      text = text.replace(block.raw, "");
      removed = true;
    }
  }
  if (removed) text = text.replace(/\n{3,}/g, "\n\n").trim();

  const mediaIds = [...plan.media.map((m) => m.id), ...generatedMediaIds];

  if (plan.editStatusId) {
    const part: PublishPart = {
      status: text,
      spoilerText: plan.spoilerText,
      mediaIds,
      quoteApprovalPolicy: plan.quotePolicy,
    };
    if (mediaIds.length) {
      part.mediaAttributes = plan.media.map((m) => ({
        id: m.id,
        description: m.description ?? null,
      }));
    } else {
      part.poll = plan.poll;
    }
    return {
      kind: "update",
      statusId: plan.editStatusId,
      visibility: plan.visibility,
      sensitive: plan.sensitive,
      parts: [part],
    };
  }

  if (plan.scheduledAt) {
    const part: PublishPart = {
      status: text,
      spoilerText: plan.spoilerText,
      mediaIds,
      inReplyToId: plan.rootReplyToId,
      quotedStatusId: plan.quoteId,
      quoteApprovalPolicy: plan.quotePolicy,
    };
    if (!mediaIds.length) part.poll = plan.poll;
    return {
      kind: "schedule",
      scheduledAt: plan.scheduledAt,
      visibility: plan.visibility,
      sensitive: plan.sensitive,
      parts: [part],
    };
  }

  const pieces =
    text.length > plan.limits.charLimit ? splitThreadText(text, plan.limits.charLimit) : [text];
  const parts: PublishPart[] = pieces.map((piece, index) => {
    const first = index === 0;
    return {
      status: piece,
      spoilerText: first ? plan.spoilerText : null,
      mediaIds: first ? mediaIds : [],
      poll: first && !mediaIds.length ? plan.poll : undefined,
      inReplyToId: first ? plan.rootReplyToId : undefined,
      quotedStatusId: first ? plan.quoteId : undefined,
      quoteApprovalPolicy: first ? plan.quotePolicy : undefined,
    };
  });
  return {
    kind: "create",
    visibility: plan.visibility,
    sensitive: plan.sensitive,
    parts,
  };
}
