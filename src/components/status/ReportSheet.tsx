import type { JSX } from "preact";
import { useState } from "preact/hooks";
import { getRest } from "../../api/client";
import type { ReportCategory, Status } from "../../api/types";
import { t } from "../../i18n/pt-BR";
import { languageName } from "../../lib/format";
import { ruleText, type InstanceRule } from "../../lib/instance-rules";
import { translateText } from "../../lib/translate";
import { reportStatus } from "../../state/status-actions";
import { currentAccount, store, toast } from "../../state/store";
import { TranslateMenu } from "../compose/TranslateMenu";
import { usePopoverDismiss } from "../compose/usePopoverDismiss";
import { Avatar } from "../ui/Avatar";
import { Icon } from "../ui/Icon";
import { Sheet } from "../ui/Sheet";
import { Content } from "./Content";

interface ReportSheetProps {
  statusKey: string;
  status: Status;
  onClose: () => void;
}

interface CategoryOption {
  value: ReportCategory;
  label: string;
  hint: string;
}

export function ReportSheet({ statusKey, status, onClose }: ReportSheetProps): JSX.Element {
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [category, setCategory] = useState<ReportCategory | null>(null);
  const [ruleIds, setRuleIds] = useState<string[]>([]);
  const [forward, setForward] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [translation, setTranslation] = useState<{ target: string; original: string } | null>(null);

  usePopoverDismiss([
    {
      isOpen: menuOpen,
      panel: ".translate-menu",
      toggle: "[data-report-translate-toggle]",
      close: () => setMenuOpen(false),
    },
  ]);

  const rules: InstanceRule[] = store.instance?.rules ?? [];
  const language = store.settings.language;
  const categories: CategoryOption[] = [
    { value: "spam", label: t.reportCategorySpam, hint: t.reportCategorySpamHint },
    { value: "legal", label: t.reportCategoryLegal, hint: t.reportCategoryLegalHint },
    ...(rules.length
      ? [
          {
            value: "violation" as ReportCategory,
            label: t.reportCategoryViolation,
            hint: t.reportCategoryViolationHint,
          },
        ]
      : []),
    { value: "other", label: t.reportCategoryOther, hint: t.reportCategoryOtherHint },
  ];
  const domain = status.account.acct.split("@")[1] ?? "";
  const currentInstance = currentAccount()?.instance ?? "";
  const showForward = !!domain && domain !== currentInstance;
  const needsRule = category === "violation";
  const canSubmit = !!category && !busy && (!needsRule || ruleIds.length > 0);

  const toggleRule = (id: string, checked: boolean): void => {
    setRuleIds((prev) => (checked ? [...prev, id] : prev.filter((ruleId) => ruleId !== id)));
  };

  const submit = async (also?: "mute" | "block"): Promise<void> => {
    const account = currentAccount();
    if (!account || !canSubmit) return;
    setBusy(true);
    try {
      const ok = await reportStatus(
        { client: getRest(account.instance, account.accessToken), instance: account.instance },
        statusKey,
        {
          comment,
          category: category ?? undefined,
          ruleIds: needsRule ? ruleIds : [],
          forward: showForward && forward,
          also,
        },
      );
      if (ok) onClose();
    } finally {
      setBusy(false);
    }
  };

  const translateDraft = async (target: string): Promise<void> => {
    const source = comment.trim();
    if (!source || translating) return;
    setMenuOpen(false);
    setTranslating(true);
    try {
      const result = await translateText(source, target);
      setTranslation({ target, original: comment });
      setComment(result.text);
    } catch (err) {
      console.warn("[oltn] report translate failed", err);
      toast(t.errorTranslate, "error");
    } finally {
      setTranslating(false);
    }
  };

  const undoTranslation = (): void => {
    if (!translation) return;
    setComment(translation.original);
    setTranslation(null);
  };

  return (
    <Sheet
      title={t.reportPost}
      onClose={onClose}
      draggable
      positionKey="report"
      footer={
        <>
          <button type="button" class="btn ghost" onClick={onClose}>
            {t.cancel}
          </button>
          <div class="spacer" />
          <button
            type="button"
            class="btn ghost"
            disabled={!canSubmit}
            onClick={() => void submit("block")}
          >
            {t.reportPlusBlock}
          </button>
          <button
            type="button"
            class="btn ghost"
            disabled={!canSubmit}
            onClick={() => void submit("mute")}
          >
            {t.reportPlusMute}
          </button>
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

        <fieldset class="report-categories">
          <legend class="report-question">{t.reportIssue}</legend>
          {categories.map((option) => (
            <label class="report-category" key={option.value}>
              <input
                type="radio"
                name="report-category"
                value={option.value}
                checked={category === option.value}
                onChange={() => {
                  setCategory(option.value);
                  if (option.value !== "violation") setRuleIds([]);
                }}
              />
              <span>
                {option.label} <small class="report-hint">{option.hint}</small>
              </span>
            </label>
          ))}
        </fieldset>

        {needsRule && (
          <fieldset class="report-rules">
            <legend class="report-question">{t.reportRules}</legend>
            {rules.map((rule) => (
              <label class="report-rule" key={rule.id}>
                <input
                  type="checkbox"
                  value={rule.id}
                  checked={ruleIds.includes(rule.id)}
                  onChange={(e) => toggleRule(rule.id, (e.target as HTMLInputElement).checked)}
                />
                <span>{ruleText(rule, language)} </span>
              </label>
            ))}
          </fieldset>
        )}

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
              {t.reportForward} <strong>{domain}</strong>
            </span>
          </label>
        )}

        <label class="report-comment-label" for="report-comment">
          {t.reportAdditionalInfo}
        </label>
        <textarea
          id="report-comment"
          class="field"
          rows={4}
          maxLength={1000}
          placeholder={t.reportComment}
          value={comment}
          onInput={(e) => {
            setComment((e.target as HTMLTextAreaElement).value);
            if (translation) setTranslation(null);
          }}
        />
        <div class="report-tools">
          <button
            type="button"
            class="btn ghost sm"
            data-report-translate-toggle
            aria-expanded={menuOpen}
            disabled={!comment.trim() || translating}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {translating ? <span class="spinner" /> : <Icon name="translate-line" size={14} />}
            {t.translate}
          </button>
          {translation && (
            <span class="report-translation">
              {t.translated} · {languageName(translation.target)}
              <button type="button" class="cw-toggle" onClick={undoTranslation}>
                {t.undo}
              </button>
            </span>
          )}
        </div>
        {menuOpen && <TranslateMenu onPick={(code) => void translateDraft(code)} />}
      </div>
    </Sheet>
  );
}
