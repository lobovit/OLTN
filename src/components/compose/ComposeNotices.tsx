import type { JSX, RefObject } from "preact";
import { t } from "../../i18n/pt-BR";
import { fullDate, languageName } from "../../lib/format";
import { Icon } from "../ui/Icon";
import { SchedulePanel } from "./SchedulePanel";
import { TranslateMenu } from "./TranslateMenu";

/** "Responding to @user" / "Quoting" pills. */
export function ComposeContextPills({
  replyTo,
  quoteId,
}: {
  replyTo: { acct: string } | null;
  quoteId: string | null;
}): JSX.Element | null {
  if (!replyTo && !quoteId) return null;
  return (
    <>
      {replyTo && (
        <div class="compose-context pill">
          <Icon name="message-1-line" size={14} />
          {t.respondingTo} @{replyTo.acct}
        </div>
      )}
      {quoteId && (
        <div class="compose-context pill">
          <Icon name="share-forward-line" size={14} />
          {t.quoting}
        </div>
      )}
    </>
  );
}

/** Content-warning input, shown while the CW toggle is on. */
export function ComposeCwInput({
  open,
  inputRef,
  value,
  onInput,
}: {
  open: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  value: string;
  onInput: (value: string) => void;
}): JSX.Element | null {
  if (!open) return null;
  return (
    <input
      ref={inputRef}
      class="field"
      placeholder={t.contentWarning}
      aria-label={t.contentWarning}
      value={value}
      onInput={(e) => onInput((e.target as HTMLInputElement).value)}
    />
  );
}

/** Translated-draft notice and the language picker menu. */
export function ComposeTranslation({
  translation,
  menuOpen,
  onUndo,
  onPick,
}: {
  translation: { target: string } | null;
  menuOpen: boolean;
  onUndo: () => void;
  onPick: (code: string) => void;
}): JSX.Element | null {
  if (!translation && !menuOpen) return null;
  return (
    <>
      {translation && (
        <div class="compose-translation">
          <Icon name="translate-line" size={14} />
          <span>
            {t.translated} · {languageName(translation.target)}
          </span>
          <button type="button" class="cw-toggle" onClick={onUndo}>
            {t.undo}
          </button>
        </div>
      )}
      {menuOpen && <TranslateMenu onPick={onPick} />}
    </>
  );
}

/** Schedule panel while editing, otherwise the scheduled-date pill. */
export function ComposeScheduleNotice({
  open,
  value,
  date,
  valid,
  onInput,
  onClear,
  onConfirm,
}: {
  open: boolean;
  value: string;
  date: Date | null;
  valid: boolean;
  onInput: (value: string) => void;
  onClear: () => void;
  onConfirm: () => void;
}): JSX.Element | null {
  if (!open && !date) return null;
  return (
    <>
      {open && (
        <SchedulePanel
          value={value}
          date={date}
          valid={valid}
          onInput={onInput}
          onClear={onClear}
          onConfirm={onConfirm}
        />
      )}
      {date && !open && (
        <div class={`compose-schedule pill ${valid ? "" : "invalid"}`}>
          <Icon name="calendar-line" size={14} />
          <span>
            {t.scheduledFor} {fullDate(date)}
          </span>
          {!valid && <span class="schedule-error">{t.scheduleTooSoon}</span>}
          <button type="button" class="cw-toggle" onClick={onClear}>
            {t.scheduleClear}
          </button>
        </div>
      )}
    </>
  );
}

/** Hint that a fenced code block will publish as an image. */
export function ComposeCodeHint({ show }: { show: boolean }): JSX.Element | null {
  if (!show) return null;
  return (
    <div class="compose-code-hint pill">
      <Icon name="code-line" size={14} />
      <span>{t.codeAsImage}</span>
    </div>
  );
}

/** Upload spinner while one or more attachments are in flight. */
export function ComposeUploading({ count }: { count: number }): JSX.Element | null {
  if (count < 1) return null;
  return (
    <div class="compose-uploading">
      <span class="spinner" /> {t.loading}
    </div>
  );
}
