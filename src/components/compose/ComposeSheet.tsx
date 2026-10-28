import type { JSX } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { useSnapshot } from "valtio";
import { getRest } from "../../api/client";
import type { ComposeIntent, ComposeVisibility, MediaAttachment } from "../../api/types";
import { t } from "../../i18n/pt-BR";
import { extractCodeBlocks } from "../../lib/code-image";
import { userMessageForError } from "../../lib/errors";
import { GIPHY_PUBLIC_KEY } from "../../lib/giphy";
import {
  planPublish,
  type ComposeDraft,
  type PublishExecution,
  type PublishPoll,
  type QuotePolicy,
} from "../../lib/publish-plan";
import { readJSON, writeJSON } from "../../lib/storage";
import { splitThreadText } from "../../lib/thread";
import { translateText } from "../../lib/translate";
import { currentAccount, setCompose, store, toast } from "../../state/store";
import { executePublish } from "../../state/publish";
import { Sheet } from "../ui/Sheet";
import {
  applyComposeContext,
  defaultComposeVisibility,
  normalizeQuotePolicy,
} from "./compose-context";
import { ComposeDropZone } from "./ComposeDropZone";
import { ComposeInput } from "./ComposeInput";
import {
  ComposeCodeHint,
  ComposeContextPills,
  ComposeCwInput,
  ComposeScheduleNotice,
  ComposeTranslation,
  ComposeUploading,
} from "./ComposeNotices";
import { ComposeToolbar } from "./ComposeToolbar";
import { EmojiPanel } from "./EmojiPanel";
import { GifPicker } from "./GifPicker";
import { MediaAttachments } from "./MediaAttachments";
import { PollEditor } from "./PollEditor";
import { QuotePolicyPicker } from "./QuotePolicyPicker";
import { useComposePanels } from "./useComposePanels";
import { useMediaUpload } from "./useMediaUpload";
import { useMentionMenu } from "./useMentionMenu";
import { usePopoverDismiss } from "./usePopoverDismiss";
import { VisibilityPicker } from "./VisibilityPicker";

const CHAR_LIMIT = 500;
const DRAFT_KEY = "compose-draft";
/** Zero-config GIPHY search: public web key, VITE_GIPHY_API_KEY overrides. */
const GIPHY_API_KEY =
  (import.meta.env.VITE_GIPHY_API_KEY as string | undefined) || GIPHY_PUBLIC_KEY;

interface Draft {
  text: string;
  spoiler: string;
  visibility: ComposeVisibility;
}

interface ComposeDraftInput {
  text: string;
  spoiler: string;
  showCw: boolean;
  visibility: ComposeVisibility;
  sensitive: boolean;
  poll: PublishPoll | null;
  media: MediaAttachment[];
  replyToId?: string;
  quoteId?: string;
  quotePolicy: QuotePolicy;
  scheduledAt?: string;
}

function makePoll(): PublishPoll {
  return { options: ["", ""], expiresIn: 86400, multiple: false };
}

function buildComposeDraft(input: ComposeDraftInput): ComposeDraft {
  return {
    text: input.text,
    spoiler: input.spoiler,
    showCw: input.showCw,
    visibility: input.visibility,
    sensitive: input.sensitive,
    poll: input.poll
      ? {
          options: input.poll.options.filter((o) => o.trim()),
          expiresIn: input.poll.expiresIn,
          multiple: input.poll.multiple,
        }
      : undefined,
    media: input.media,
    replyToId: input.replyToId,
    quoteId: input.quoteId,
    quotePolicy: input.quotePolicy,
    scheduledAt: input.scheduledAt,
  };
}

function composeTitle(mode: ComposeIntent["mode"]): string {
  switch (mode) {
    case "reply":
      return t.composeReply;
    case "quote":
      return t.composeQuote;
    case "edit":
      return t.composeEdit;
    default:
      return t.composeTitle;
  }
}

interface ScheduleState {
  date: Date | null;
  valid: boolean;
  blocked: boolean;
}

function scheduleState(value: string, isEdit: boolean, threadParts: number): ScheduleState {
  const date = value ? new Date(value) : null;
  return {
    date,
    valid: !date || date.getTime() >= Date.now() + 5 * 60_000,
    blocked: isEdit || threadParts > 1,
  };
}

function publishedMessage(kind: PublishExecution["kind"], isEdit: boolean): string {
  if (kind === "schedule") return t.scheduledPost;
  return isEdit ? t.saved : t.post;
}

export function ComposeSheet(): JSX.Element | null {
  const intent = useSnapshot(store).ui.compose;
  if (!intent) return null;
  return <ComposeInner key={`${intent.mode}:${intent.statusId ?? ""}`} intent={intent} />;
}

function ComposeInner({ intent }: { intent: ComposeIntent }): JSX.Element {
  const isEdit = intent.mode === "edit";
  const account = currentAccount();
  const instance = account?.instance ?? "";
  const [text, setText] = useState("");
  const [spoiler, setSpoiler] = useState("");
  const [showCw, setShowCw] = useState(false);
  const [visibility, setVisibility] = useState<ComposeVisibility>("public");
  const [sensitive, setSensitive] = useState(false);
  const [media, setMedia] = useState<MediaAttachment[]>([]);
  const [poll, setPoll] = useState<PublishPoll | null>(null);
  const [busy, setBusy] = useState(false);
  const [charLimit, setCharLimit] = useState(CHAR_LIMIT);
  const [localSupported, setLocalSupported] = useState(() =>
    /pleroma|akkoma/i.test(store.instance?.version ?? ""),
  );
  const [replyTo, setReplyTo] = useState<{ id: string; acct: string } | null>(null);
  const [quoteId, setQuoteId] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
  const [translation, setTranslation] = useState<{ target: string; original: string } | null>(null);
  const [scheduledAt, setScheduledAt] = useState("");
  const [quotePolicy, setQuotePolicy] = useState<QuotePolicy>(() =>
    normalizeQuotePolicy(store.me?.source?.quotePolicy),
  );
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const cwRef = useRef<HTMLInputElement>(null);

  const panels = useComposePanels();
  const mentions = useMentionMenu({ instance, account, text, setText, textRef });
  const uploader = useMediaUpload({ instance, account, media, poll, setMedia });
  usePopoverDismiss([
    {
      isOpen: panels.emojiOpen,
      panel: ".emoji-picker",
      toggle: "[data-emoji-toggle]",
      close: panels.closeEmoji,
    },
    {
      isOpen: panels.gifOpen,
      panel: ".gif-picker",
      toggle: "[data-gif-toggle]",
      close: panels.closeGif,
    },
    {
      isOpen: panels.transOpen,
      panel: ".translate-menu",
      toggle: "[data-translate-toggle]",
      close: panels.closeTranslation,
    },
    {
      isOpen: panels.scheduleOpen,
      panel: ".schedule-panel",
      toggle: "[data-schedule-toggle]",
      close: panels.closeSchedule,
    },
  ]);

  /* instance character limit + local post support (Pleroma/Akkoma) */
  useEffect(() => {
    if (!instance) return;
    let cancelled = false;
    void (async () => {
      try {
        const client = getRest(instance, account?.accessToken);
        const info = await client.v2.instance.fetch();
        const max = info.configuration?.statuses?.maxCharacters;
        if (!cancelled && max) setCharLimit(max);
        if (!cancelled && info.version) {
          setLocalSupported(/pleroma|akkoma/i.test(info.version));
        }
      } catch {
        /* keep the default */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [instance, account]);

  const insertAtCursor = (snippet: string): void => {
    const ta = textRef.current;
    const start = ta?.selectionStart ?? text.length;
    const end = ta?.selectionEnd ?? start;
    setText(text.slice(0, start) + snippet + text.slice(end));
    if (ta) {
      requestAnimationFrame(() => {
        ta.focus();
        const pos = start + snippet.length;
        ta.setSelectionRange(pos, pos);
      });
    }
  };

  const translateDraft = async (target: string): Promise<void> => {
    const source = text.trim();
    if (!source || translating) return;
    panels.closeTranslation();
    setTranslating(true);
    try {
      const result = await translateText(source, target);
      setTranslation({ target, original: text });
      setText(result.text);
    } catch (err) {
      console.warn("[oltn] translate failed", err);
      toast(t.errorTranslate, "error");
    } finally {
      setTranslating(false);
    }
  };

  const undoTranslation = (): void => {
    if (!translation) return;
    setText(translation.original);
    setTranslation(null);
  };

  const toggleCw = (): void => {
    const next = !showCw;
    setShowCw(next);
    if (next) requestAnimationFrame(() => cwRef.current?.focus());
  };

  const togglePoll = (): void => {
    setPoll(poll ? null : makePoll());
    if (!poll) setMedia([]);
  };

  /* draft (new mode) */
  useEffect(() => {
    if (intent.mode !== "new") return;
    const draft = readJSON<Draft | null>(DRAFT_KEY, null);
    if (draft) {
      setText(draft.text);
      setSpoiler(draft.spoiler);
      setVisibility(draft.visibility);
      if (draft.spoiler) setShowCw(true);
    }
  }, []);

  useEffect(() => {
    if (intent.mode !== "new") return;
    const timer = window.setTimeout(() => {
      if (text || spoiler) {
        writeJSON(DRAFT_KEY, { text, spoiler, visibility } satisfies Draft);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [text, spoiler, visibility, intent.mode]);

  /* reply/quote/edit context */
  useEffect(() => {
    const statusId = intent.statusId;
    if (!statusId || !instance) return;
    let cancelled = false;
    void (async () => {
      const client = getRest(instance, account?.accessToken);
      try {
        const status = await client.v1.statuses.$select(statusId).fetch();
        if (cancelled) return;
        applyComposeContext(
          status,
          intent.mode,
          instance,
          {
            setReplyTo,
            setQuoteId,
            setText,
            setSpoiler,
            setShowCw,
            setVisibility,
            setSensitive,
            setMedia,
            setPoll,
            setQuotePolicy,
          },
          { defaultVisibility: defaultComposeVisibility(store.me?.source?.privacy) },
        );
      } catch {
        toast(t.errorLoad, "error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [intent, instance, account]);

  useEffect(() => {
    textRef.current?.focus();
  }, []);

  const remaining = charLimit - text.length;
  const canPoll = !media.length && !uploader.uploading;
  const pollReady = !poll || poll.options.every((o) => o.trim());
  const threadParts =
    !isEdit && text.trim().length > charLimit ? splitThreadText(text.trim(), charLimit).length : 1;
  const {
    date: scheduleDate,
    valid: scheduleValid,
    blocked: scheduleBlocked,
  } = scheduleState(scheduledAt, isEdit, threadParts);
  const canSubmit =
    !busy &&
    !uploader.uploading &&
    (text.trim().length > 0 || media.length > 0) &&
    (isEdit || remaining >= 0) &&
    pollReady &&
    (!scheduleDate || (scheduleValid && !scheduleBlocked));

  const codeBlocks = isEdit || poll ? [] : extractCodeBlocks(text);

  const submit = async (): Promise<void> => {
    if (!account || !canSubmit) return;
    setBusy(true);
    try {
      await uploader.flushDescriptions();
      const draft = buildComposeDraft({
        text,
        spoiler,
        showCw,
        visibility,
        sensitive,
        poll,
        media,
        replyToId: replyTo?.id,
        quoteId: quoteId ?? undefined,
        quotePolicy,
        scheduledAt:
          scheduleDate && scheduleValid && !scheduleBlocked
            ? scheduleDate.toISOString()
            : undefined,
      });
      const plan = planPublish(
        draft,
        { charLimit, maxMedia: 4 },
        {
          mode: intent.mode,
          statusId: intent.statusId,
        },
      );
      const outcome = await executePublish(
        { client: getRest(instance, account.accessToken), instance },
        plan,
      );
      if (!outcome.ok) {
        if (outcome.remaining.length) setText(outcome.remaining.join("\n\n"));
        toast(userMessageForError(outcome.error, isEdit ? t.errorSave : t.errorPost), "error");
        return;
      }
      if (intent.mode === "new") writeJSON(DRAFT_KEY, null);
      toast(publishedMessage(outcome.kind, isEdit), "ok");
      setCompose(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      title={composeTitle(intent.mode)}
      onClose={() => setCompose(null)}
      draggable
      class="compose-sheet"
      headerActions={
        <span
          class={`char-count ${remaining < 0 ? "over" : ""}`}
          title={remaining < 0 ? t.threadAutoHint : t.charLeft}
        >
          {remaining < 0 ? `${threadParts} ${t.threadCount}` : remaining}
        </span>
      }
      footer={
        <ComposeToolbar
          fileRef={fileRef}
          onFiles={(files) => void uploader.upload(files)}
          mediaCount={media.length}
          hasPoll={!!poll}
          canPoll={canPoll}
          showCw={showCw}
          onToggleCw={toggleCw}
          onTogglePoll={togglePoll}
          panels={panels}
          translating={translating}
          hasText={!!text.trim()}
          scheduleBlocked={scheduleBlocked}
          scheduled={!!scheduleDate}
          canSubmit={canSubmit}
          busy={busy}
          isEdit={isEdit}
          onSubmit={() => void submit()}
        />
      }
    >
      <ComposeDropZone onFiles={(files) => void uploader.upload(files)}>
        <ComposeContextPills replyTo={replyTo} quoteId={quoteId} />
        <ComposeCwInput open={showCw} inputRef={cwRef} value={spoiler} onInput={setSpoiler} />
        <ComposeInput
          text={text}
          textRef={textRef}
          mentions={mentions}
          reply={intent.mode === "reply"}
          onText={setText}
          onResetTranslation={() => setTranslation(null)}
          onUpload={(files) => void uploader.upload(files)}
          onSubmit={() => void submit()}
        />
        <ComposeTranslation
          translation={translation}
          menuOpen={panels.transOpen}
          onUndo={undoTranslation}
          onPick={(code) => void translateDraft(code)}
        />
        <ComposeScheduleNotice
          open={panels.scheduleOpen}
          value={scheduledAt}
          date={scheduleDate}
          valid={scheduleValid}
          onInput={setScheduledAt}
          onClear={() => setScheduledAt("")}
          onConfirm={panels.closeSchedule}
        />
        <ComposeCodeHint show={codeBlocks.length > 0} />
        {panels.gifOpen && (
          <GifPicker
            apiKey={GIPHY_API_KEY}
            onSelect={(gif) => {
              panels.closeGif();
              void uploader.pickGif(gif);
            }}
          />
        )}
        {panels.emojiOpen && (
          <EmojiPanel instance={instance} account={account} onInsert={insertAtCursor} />
        )}
        <MediaAttachments
          media={media}
          onDescription={(index, value) => {
            const item = media[index];
            if (item) uploader.describe(item, value);
          }}
          onRemove={(index) => setMedia((prev) => prev.filter((_, i) => i !== index))}
        />
        <ComposeUploading count={uploader.uploading} />
        {poll && <PollEditor value={poll} onChange={setPoll} />}
        <VisibilityPicker
          value={visibility}
          localSupported={localSupported}
          onChange={setVisibility}
          disabled={isEdit}
          disabledHint={t.editVisibilityLocked}
        />
        {isEdit && <p class="muted compose-edit-hint">{t.editVisibilityLocked}</p>}
        <QuotePolicyPicker value={quotePolicy} onChange={setQuotePolicy} />
      </ComposeDropZone>
    </Sheet>
  );
}
