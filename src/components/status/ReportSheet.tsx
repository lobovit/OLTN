import type { JSX } from "preact";
import { useState } from "preact/hooks";
import { getRest } from "../../api/client";
import type { Status } from "../../api/types";
import { t } from "../../i18n/pt-BR";
import { reportStatus } from "../../state/status-actions";
import { currentAccount } from "../../state/store";
import { Avatar } from "../ui/Avatar";
import { Sheet } from "../ui/Sheet";
import { Content } from "./Content";

interface ReportSheetProps {
  statusKey: string;
  status: Status;
  onClose: () => void;
}

export function ReportSheet({ statusKey, status, onClose }: ReportSheetProps): JSX.Element {
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (): Promise<void> => {
    const account = currentAccount();
    if (!account || busy) return;
    setBusy(true);
    try {
      const ok = await reportStatus(
        { client: getRest(account.instance, account.accessToken), instance: account.instance },
        statusKey,
        comment,
      );
      if (ok) onClose();
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
