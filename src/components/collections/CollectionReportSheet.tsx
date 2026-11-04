import type { JSX } from "preact";
import { useState } from "preact/hooks";
import type { Account, Collection, ReportAccountParams, ReportCategory } from "../../api/types";
import { t } from "../../i18n/pt-BR";
import { userMessageForError } from "../../lib/errors";
import { clientFor } from "../../lib/identity";
import { currentAccount, toast } from "../../state/store";
import { Avatar } from "../ui/Avatar";
import { EmojiText } from "../status/EmojiText";
import { Sheet } from "../ui/Sheet";
import "../status/status.css";

interface Props {
  collection: Collection;
  owner: Account;
  instance: string;
  onClose: () => void;
}

interface CategoryOption {
  value: ReportCategory;
  label: string;
  hint: string;
}

export function CollectionReportSheet({
  collection,
  owner,
  instance,
  onClose,
}: Props): JSX.Element {
  const [category, setCategory] = useState<ReportCategory | null>(null);
  const [comment, setComment] = useState("");
  const [forward, setForward] = useState(false);
  const [busy, setBusy] = useState(false);

  const ownerDomain = owner.acct.split("@")[1] ?? "";
  const ownInstance = currentAccount()?.instance ?? "";
  const showForward = !!ownerDomain && ownerDomain !== ownInstance;
  const categories: CategoryOption[] = [
    { value: "spam", label: t.reportCategorySpam, hint: t.reportCategorySpamHint },
    { value: "legal", label: t.reportCategoryLegal, hint: t.reportCategoryLegalHint },
    { value: "other", label: t.reportCategoryOther, hint: t.reportCategoryOtherHint },
  ];
  const canSubmit = !!category && !busy;

  const submit = async (): Promise<void> => {
    if (!canSubmit || !category) return;
    setBusy(true);
    try {
      const params: ReportAccountParams & { collectionIds: string[] } = {
        accountId: owner.id,
        collectionIds: [collection.id],
        category,
        comment: comment.trim() || null,
        forward: showForward && forward,
      };
      await clientFor(instance).client.v1.reports.create(params);
      toast(t.reportSent, "ok");
      onClose();
    } catch (err) {
      console.warn("[oltn] collection report failed", err);
      toast(userMessageForError(err, t.errorGeneric), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      title={t.collectionReport}
      onClose={onClose}
      draggable
      positionKey="collection-report"
      footer={
        <>
          <button type="button" class="btn ghost" onClick={onClose}>
            {t.cancel}
          </button>
          <div class="spacer" />
          <button
            type="button"
            class="btn primary"
            disabled={!canSubmit}
            onClick={() => void submit()}
          >
            {busy && <span class="spinner" />}
            {busy ? t.loading : t.report}
          </button>
        </>
      }
    >
      <div class="report-sheet">
        <div class="report-target">
          <Avatar src={owner.avatar} name={owner.displayName || owner.username} size={34} />
          <div class="row-main">
            <div class="row-title">{collection.name}</div>
            <div class="row-sub">
              {t.collectionBy}{" "}
              <EmojiText text={owner.displayName || owner.username} emojis={owner.emojis} /> @
              {owner.acct}
            </div>
          </div>
        </div>

        <fieldset class="report-categories">
          <legend class="report-question">{t.reportIssue}</legend>
          {categories.map((option) => (
            <label class="report-category" key={option.value}>
              <input
                type="radio"
                name="collection-report-category"
                value={option.value}
                checked={category === option.value}
                onChange={() => setCategory(option.value)}
              />
              <span>
                {option.label} <small class="report-hint">{option.hint}</small>
              </span>
            </label>
          ))}
        </fieldset>

        {showForward && (
          <label class="report-forward">
            <input
              type="checkbox"
              class="switch"
              role="switch"
              checked={forward}
              onChange={(e) => setForward((e.target as HTMLInputElement).checked)}
            />
            <span>
              {t.reportForward} <strong>{ownerDomain}</strong>
            </span>
          </label>
        )}

        <label class="report-comment-label" for="collection-report-comment">
          {t.reportAdditionalInfo}
        </label>
        <textarea
          id="collection-report-comment"
          class="field"
          rows={4}
          maxLength={1000}
          placeholder={t.reportComment}
          value={comment}
          onInput={(e) => setComment((e.target as HTMLTextAreaElement).value)}
        />
      </div>
    </Sheet>
  );
}
