import type { Dispatch, StateUpdater } from "preact/hooks";
import type {
  ComposeIntent,
  ComposeVisibility,
  MediaAttachment,
  Poll,
  Status,
} from "../../api/types";
import { htmlToPlainText } from "../../lib/format";
import type { PublishPoll, QuotePolicy } from "../../lib/publish-plan";

export interface ComposeContextSetters {
  setReplyTo: Dispatch<StateUpdater<{ id: string; acct: string } | null>>;
  setQuoteId: Dispatch<StateUpdater<string | null>>;
  setText: Dispatch<StateUpdater<string>>;
  setSpoiler: Dispatch<StateUpdater<string>>;
  setShowCw: Dispatch<StateUpdater<boolean>>;
  setVisibility: Dispatch<StateUpdater<ComposeVisibility>>;
  setSensitive: Dispatch<StateUpdater<boolean>>;
  setMedia: Dispatch<StateUpdater<MediaAttachment[]>>;
  setPoll: Dispatch<StateUpdater<PublishPoll | null>>;
  setQuotePolicy: Dispatch<StateUpdater<QuotePolicy>>;
}

/** Falls back to "public" for missing or unsupported quote policies. */
export function normalizeQuotePolicy(value: string | null | undefined): QuotePolicy {
  return value === "public" || value === "followers" || value === "nobody" ? value : "public";
}

/** Reads the quote policy back from a status' quote approval summary. */
function quotePolicyFrom(automatic: readonly string[]): QuotePolicy {
  if (automatic.includes("public")) return "public";
  if (automatic.includes("followers")) return "followers";
  return "nobody";
}

/** Rebuilds the `PublishPoll` draft from an existing status poll. */
function editPoll(poll: Poll | null | undefined): PublishPoll | null {
  if (!poll) return null;
  return {
    options: poll.options.map((option) => option.title),
    expiresIn: poll.expiresAt
      ? Math.max(300, Math.ceil((Date.parse(poll.expiresAt) - Date.now()) / 1000))
      : 86400,
    multiple: poll.multiple,
  };
}

/** Loads the status behind a reply/quote/edit intent into the composer. */
export function applyComposeContext(
  status: Status,
  mode: ComposeIntent["mode"],
  instance: string,
  set: ComposeContextSetters,
): void {
  if (mode === "reply") {
    const acct = status.account.acct.includes("@")
      ? status.account.acct
      : `${status.account.acct}@${instance}`;
    set.setReplyTo({ id: status.id, acct });
    // Remote accounts only become a mention with the full user@domain;
    // a bare @username would be posted as plain text.
    set.setText((prev) => prev || `@${status.account.acct} `);
    return;
  }
  if (mode === "quote") {
    set.setQuoteId(status.id);
    return;
  }
  if (mode !== "edit") return;
  set.setText(() => htmlToPlainText(status.content));
  set.setSpoiler(status.spoilerText);
  set.setShowCw(!!status.spoilerText);
  set.setVisibility(status.visibility);
  set.setSensitive(status.sensitive);
  set.setMedia(status.mediaAttachments);
  set.setPoll(editPoll(status.poll));
  const approval = status.quoteApproval;
  if (approval) set.setQuotePolicy(quotePolicyFrom(approval.automatic));
}
