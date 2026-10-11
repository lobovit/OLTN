import type { JSX } from "preact";
import { useState } from "preact/hooks";
import { getRest } from "../../api/client";
import type { Status } from "../../api/types";
import { t } from "../../i18n/pt-BR";
import { userMessageForError } from "../../lib/errors";
import { localAccountId, localStatus } from "../../lib/resolve";
import { currentAccount, toast } from "../../state/store";
import { Avatar } from "../ui/Avatar";
import { Sheet } from "../ui/Sheet";
import { Content } from "./Content";

interface ReportSheetProps {
  status: Status;
  sourceInstance: string;
  onClose: () => void;
}

export function ReportSheet({ status, sourceInstance, onClose }: ReportSheetProps): JSX.Element {
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (): Promise<void> => {
    const account = currentAccount();
    if (!account || busy) return;
    setBusy(true);
    try {
      const [local, accountId] = await Promise.all([
        localStatus(account.instance, account.accessToken, status, sourceInstance),
        localAccountId(account.instance, account.accessToken, status.account, sourceInstance),
      ]);
      if (!local || !accountId) throw new Error("report_resolve_failed");
      await getRest(account.instance, account.accessToken).v1.reports.create({
        accountId,
        statusIds: [local.id],
        comment: comment.trim() || undefined,
      });
      toast(t.reportSent, "ok");
      onClose();
    } catch (err) {
      console.warn("[oltn] report failed", err);
      toast(userMessageForError(err, t.errorGeneric), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      title={t.reportPost}
      onClose={onClose}
      footer={
        <>
          <button type="button" class="btn ghost" onClick={onClose}>
            {t.cancel}
          </button>
          <div class="spacer" />
          <button type="button" class="btn primary" disabled={busy} onClick={() => void submit()}>
            {busy && <span class="spinner" />}
            {busy ? t.loading : t.report}
          </button>
        </>
      }
    >
      <div class="report-sheet">
        <div class="report-target">
          <Avatar
            src={status.account.avatar}
            name={status.account.displayName || status.account.username}
            size={34}
          />
          <div class="row-main">
            <div class="row-title">{status.account.displayName || status.account.username}</div>
            <div class="row-sub">@{status.account.acct}</div>
          </div>
        </div>
        <div class="report-preview clamp-2">
          <Content html={status.content} emojis={status.emojis} />
        </div>
        <textarea
          class="field"
          rows={4}
          placeholder={t.reportComment}
          aria-label={t.reportComment}
          value={comment}
          onInput={(e) => setComment((e.target as HTMLTextAreaElement).value)}
        />
      </div>
    </Sheet>
  );
}
