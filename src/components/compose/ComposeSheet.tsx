import type { JSX } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { useSnapshot } from "valtio";
import { getRest } from "../../api/client";
import type { Account, ComposeIntent, ComposeVisibility, MediaAttachment } from "../../api/types";
import { t } from "../../i18n/pt-BR";
import { extractCodeBlocks } from "../../lib/code-image";
import { fullDate, htmlToPlainText, languageName } from "../../lib/format";
import { userMessageForError } from "../../lib/errors";
import { GIPHY_PUBLIC_KEY, type GifResult } from "../../lib/giphy";
import { clientFor } from "../../lib/identity";
import { planPublish, type ComposeDraft, type PublishPoll } from "../../lib/publish-plan";
import { readJSON, writeJSON } from "../../lib/storage";
import { splitThreadText } from "../../lib/thread";
import { translateText } from "../../lib/translate";
import { currentAccount, setCompose, store, toast } from "../../state/store";
import { executePublish } from "../../state/publish";
import { Sheet } from "../ui/Sheet";
import { Icon } from "../ui/Icon";
import { EmojiPanel } from "./EmojiPanel";
import { GifPicker } from "./GifPicker";
import { MediaAttachments } from "./MediaAttachments";
import { MentionMenu } from "./MentionMenu";
import { PollEditor } from "./PollEditor";
import { SchedulePanel } from "./SchedulePanel";
import { TranslateMenu } from "./TranslateMenu";
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

function submitLabel(state: { busy: boolean; isEdit: boolean; scheduled: boolean }): string {
  if (state.busy) {
    if (state.isEdit) return t.saving;
    return state.scheduled ? t.scheduling : t.posting;
  }
  if (state.isEdit) return t.save;
  return state.scheduled ? t.schedule : t.post;
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
  const [uploading, setUploading] = useState(0);
  const [poll, setPoll] = useState<PublishPoll | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [charLimit, setCharLimit] = useState(CHAR_LIMIT);
  const [localSupported, setLocalSupported] = useState(() =>
    /pleroma|akkoma/i.test(store.instance?.version ?? ""),
  );
  const [replyTo, setReplyTo] = useState<{ id: string; acct: string } | null>(null);
  const [quoteId, setQuoteId] = useState<string | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionItems, setMentionItems] = useState<Account[]>([]);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [gifOpen, setGifOpen] = useState(false);
  const [transOpen, setTransOpen] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [translation, setTranslation] = useState<{ target: string; original: string } | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const mentionSeq = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const cwRef = useRef<HTMLInputElement>(null);

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

  /* closes popovers (emoji/gif/translation/schedule) when clicking outside or pressing Escape */
  useEffect(() => {
    if (!emojiOpen && !transOpen && !scheduleOpen && !gifOpen) return;
    const onDown = (e: PointerEvent): void => {
      const el = e.target as HTMLElement;
      if (emojiOpen && !el.closest(".emoji-picker") && !el.closest("[data-emoji-toggle]")) {
        setEmojiOpen(false);
      }
      if (gifOpen && !el.closest(".gif-picker") && !el.closest("[data-gif-toggle]")) {
        setGifOpen(false);
      }
      if (transOpen && !el.closest(".translate-menu") && !el.closest("[data-translate-toggle]")) {
        setTransOpen(false);
      }
      if (scheduleOpen && !el.closest(".schedule-panel") && !el.closest("[data-schedule-toggle]")) {
        setScheduleOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        setEmojiOpen(false);
        setGifOpen(false);
        setTransOpen(false);
        setScheduleOpen(false);
      }
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [emojiOpen, gifOpen, transOpen, scheduleOpen]);

  /* account search for mention autocomplete (@partial) */
  useEffect(() => {
    if (mentionQuery == null || mentionQuery.length < 1 || !account) {
      setMentionItems([]);
      return;
    }
    const query = mentionQuery;
    const seq = ++mentionSeq.current;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const client = getRest(instance, account.accessToken);
          const result = await client.v2.search.list({
            q: query,
            type: "accounts",
            resolve: false,
            limit: 5,
          });
          if (seq !== mentionSeq.current) return;
          setMentionItems(result.accounts.slice(0, 5));
          setMentionIndex(0);
        } catch (err) {
          console.warn("[oltn] mention search failed", err);
        }
      })();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [mentionQuery, instance, account]);

  const syncMentionQuery = (target: HTMLTextAreaElement): void => {
    const cursor = target.selectionStart ?? target.value.length;
    const before = target.value.slice(0, cursor);
    const match = /(^|[\s\u00a0(])@([a-zA-Z0-9_]{1,})$/.exec(before);
    setMentionQuery(match ? match[2] : null);
  };

  const applyMention = (picked: Account): void => {
    const ta = textRef.current;
    if (!ta) return;
    const cursor = ta.selectionStart ?? text.length;
    const before = text.slice(0, cursor);
    const match = /@([a-zA-Z0-9_]*)$/.exec(before);
    if (!match) {
      setMentionQuery(null);
      return;
    }
    const start = cursor - match[0].length;
    const insert = `@${picked.acct}`;
    const next = text.slice(0, start) + insert + text.slice(cursor);
    setText(next);
    setMentionQuery(null);
    setMentionItems([]);
    const pos = start + insert.length;
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(pos, pos);
    });
  };

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
    setTransOpen(false);
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
        if (intent.mode === "reply") {
          const acct = status.account.acct.includes("@")
            ? status.account.acct
            : `${status.account.acct}@${instance}`;
          setReplyTo({ id: status.id, acct });
          setText((prev) => prev || `@${status.account.username} `);
        } else if (intent.mode === "quote") {
          setQuoteId(status.id);
        } else if (intent.mode === "edit") {
          setText(htmlToPlainText(status.content));
          setSpoiler(status.spoilerText);
          if (status.spoilerText) setShowCw(true);
          setVisibility(status.visibility);
          setSensitive(status.sensitive);
          setMedia(status.mediaAttachments);
          const statusPoll = status.poll;
          if (statusPoll) {
            setPoll({
              options: statusPoll.options.map((o) => o.title),
              expiresIn: statusPoll.expiresAt
                ? Math.max(300, Math.ceil((Date.parse(statusPoll.expiresAt) - Date.now()) / 1000))
                : 86400,
              multiple: statusPoll.multiple,
            });
          }
        }
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
  const canPoll = !media.length && !uploading;
  const pollReady = !poll || poll.options.every((o) => o.trim());
  const threadParts =
    !isEdit && text.trim().length > charLimit ? splitThreadText(text.trim(), charLimit).length : 1;
  const scheduleDate = scheduledAt ? new Date(scheduledAt) : null;
  const scheduleValid = !scheduleDate || scheduleDate.getTime() >= Date.now() + 5 * 60_000;
  const scheduleBlocked = isEdit || threadParts > 1;
  const canSubmit =
    !busy &&
    !uploading &&
    (text.trim().length > 0 || media.length > 0) &&
    (isEdit || remaining >= 0) &&
    pollReady &&
    (!scheduleDate || (scheduleValid && !scheduleBlocked));

  const codeBlocks = isEdit || poll ? [] : extractCodeBlocks(text);

  const uploadFile = async (file: File, description?: string): Promise<void> => {
    if (!account) return;
    setUploading((n) => n + 1);
    try {
      const attachment = await clientFor(instance).client.v1.media.create({
        file,
        description,
      });
      setMedia((prev) => [...prev, attachment].slice(0, 4));
    } catch (err) {
      console.warn("[oltn] upload failed", err);
      toast(t.errorUpload, "error");
    } finally {
      setUploading((n) => n - 1);
    }
  };

  const upload = async (files: FileList | File[]): Promise<void> => {
    let count = media.length;
    for (const file of files) {
      if (count >= 4) break;
      count += 1;
      await uploadFile(file);
    }
  };

  /** Downloads the selected GIF and attaches it with its alt text. */
  const pickGif = async (gif: GifResult): Promise<void> => {
    if (!account || media.length >= 4 || poll || uploading) return;
    setGifOpen(false);
    setUploading((n) => n + 1);
    try {
      const blob = await fetch(gif.url, { referrerPolicy: "no-referrer" }).then((res) =>
        res.blob(),
      );
      const file = new File([blob], "image.gif", { type: blob.type || "image/gif" });
      await uploadFile(file, gif.alt || undefined);
    } catch (err) {
      console.warn("[oltn] gif download failed", err);
      toast(t.errorUpload, "error");
    } finally {
      setUploading((n) => n - 1);
    }
  };

  const submit = async (): Promise<void> => {
    if (!account || !canSubmit) return;
    setBusy(true);
    try {
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
      toast(outcome.kind === "schedule" ? t.scheduledPost : isEdit ? t.saved : t.post, "ok");
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
      positionKey="compose"
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
        <>
          <input
            ref={fileRef}
            class="compose-file"
            type="file"
            accept="image/*,video/*,audio/*"
            multiple
            onChange={(e) => {
              const files = (e.target as HTMLInputElement).files;
              if (files?.length) void upload(files);
              (e.target as HTMLInputElement).value = "";
            }}
          />
          <button
            type="button"
            class="icon-btn"
            title={t.attachMedia}
            aria-label={t.attachMedia}
            disabled={media.length >= 4 || !!poll}
            onClick={() => fileRef.current?.click()}
          >
            <Icon name="attachment-line" size={20} />
          </button>
          <button
            type="button"
            class={`icon-btn ${poll ? "active" : ""}`}
            title={t.addPoll}
            aria-label={t.addPoll}
            disabled={!canPoll}
            onClick={() => {
              setPoll(poll ? null : makePoll());
              if (!poll) setMedia([]);
            }}
          >
            <Icon name="list-check-line" size={20} />
          </button>
          <button
            type="button"
            class={`icon-btn toolbar-cw ${showCw ? "active" : ""}`}
            title={t.contentWarning}
            aria-label={t.contentWarning}
            aria-pressed={showCw}
            onClick={() => {
              const next = !showCw;
              setShowCw(next);
              if (next) requestAnimationFrame(() => cwRef.current?.focus());
            }}
          >
            CW
          </button>
          <button
            type="button"
            class={`icon-btn ${emojiOpen ? "active" : ""}`}
            data-emoji-toggle
            title={t.emojiPicker}
            aria-label={t.emojiPicker}
            aria-expanded={emojiOpen}
            onClick={() => {
              setEmojiOpen((v) => !v);
              setGifOpen(false);
              setTransOpen(false);
            }}
          >
            <Icon name="emoji-line" size={20} />
          </button>
          <button
            type="button"
            class={`icon-btn ${gifOpen ? "active" : ""}`}
            data-gif-toggle
            title={t.gif}
            aria-label={t.gif}
            aria-expanded={gifOpen}
            disabled={media.length >= 4 || !!poll}
            onClick={() => {
              setGifOpen((v) => !v);
              setEmojiOpen(false);
              setTransOpen(false);
              setScheduleOpen(false);
            }}
          >
            <Icon name="movie-line" size={20} />
          </button>
          <button
            type="button"
            class={`icon-btn ${transOpen ? "active" : ""}`}
            data-translate-toggle
            title={t.translateTo}
            aria-label={t.translateTo}
            aria-expanded={transOpen}
            disabled={!text.trim() || translating}
            onClick={() => {
              setTransOpen((v) => !v);
              setEmojiOpen(false);
            }}
          >
            {translating ? <span class="spinner" /> : <Icon name="translate-line" size={20} />}
          </button>
          <button
            type="button"
            class={`icon-btn ${scheduleOpen || scheduleDate ? "active" : ""}`}
            data-schedule-toggle
            title={scheduleBlocked ? t.scheduleNoThread : t.schedule}
            aria-label={t.schedule}
            aria-expanded={scheduleOpen}
            disabled={scheduleBlocked}
            onClick={() => {
              setScheduleOpen((v) => !v);
              setEmojiOpen(false);
              setTransOpen(false);
            }}
          >
            <Icon name="calendar-line" size={20} />
          </button>
          <div class="spacer" />
          <button
            type="button"
            class="btn primary"
            disabled={!canSubmit}
            onClick={() => void submit()}
          >
            {busy && <span class="spinner" />}
            {submitLabel({ busy, isEdit, scheduled: !!scheduleDate })}
          </button>
        </>
      }
    >
      <div
        class={`compose ${dragOver ? "drag-over" : ""}`}
        onDragOver={(e) => {
          if (e.dataTransfer?.types.includes("Files")) {
            e.preventDefault();
            setDragOver(true);
          }
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const files = e.dataTransfer?.files;
          if (files?.length) void upload(files);
        }}
      >
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
        {showCw && (
          <input
            ref={cwRef}
            class="field"
            placeholder={t.contentWarning}
            aria-label={t.contentWarning}
            value={spoiler}
            onInput={(e) => setSpoiler((e.target as HTMLInputElement).value)}
          />
        )}
        <textarea
          ref={textRef}
          class="field compose-text"
          rows={6}
          placeholder={intent.mode === "reply" ? t.composeReplyPlaceholder : t.composePlaceholder}
          value={text}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            setText(target.value);
            syncMentionQuery(target);
            if (translation) setTranslation(null);
          }}
          onClick={(e) => syncMentionQuery(e.currentTarget as HTMLTextAreaElement)}
          onKeyUp={(e) => {
            if (e.key.startsWith("Arrow") || e.key === "Home" || e.key === "End") {
              syncMentionQuery(e.currentTarget as HTMLTextAreaElement);
            }
          }}
          onPaste={(e) => {
            const files = e.clipboardData?.files;
            if (files?.length) {
              e.preventDefault();
              void upload(files);
            }
          }}
          onBlur={() => setMentionItems([])}
          onKeyDown={(e) => {
            if (mentionItems.length) {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setMentionIndex((i) => Math.min(i + 1, mentionItems.length - 1));
                return;
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setMentionIndex((i) => Math.max(i - 1, 0));
                return;
              }
              if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                applyMention(mentionItems[mentionIndex]);
                return;
              }
            }
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") void submit();
          }}
        />
        <MentionMenu
          items={mentionItems}
          index={mentionIndex}
          onIndex={setMentionIndex}
          onPick={applyMention}
        />
        {translation && (
          <div class="compose-translation">
            <Icon name="translate-line" size={14} />
            <span>
              {t.translated} · {languageName(translation.target)}
            </span>
            <button type="button" class="cw-toggle" onClick={undoTranslation}>
              {t.undo}
            </button>
          </div>
        )}
        {transOpen && <TranslateMenu onPick={(code) => void translateDraft(code)} />}
        {scheduleOpen && (
          <SchedulePanel
            value={scheduledAt}
            date={scheduleDate}
            valid={scheduleValid}
            onInput={setScheduledAt}
            onClear={() => setScheduledAt("")}
            onConfirm={() => setScheduleOpen(false)}
          />
        )}
        {scheduleDate && !scheduleOpen && (
          <div class={`compose-schedule pill ${scheduleValid ? "" : "invalid"}`}>
            <Icon name="calendar-line" size={14} />
            <span>
              {t.scheduledFor} {fullDate(scheduleDate)}
            </span>
            {!scheduleValid && <span class="schedule-error">{t.scheduleTooSoon}</span>}
            <button type="button" class="cw-toggle" onClick={() => setScheduledAt("")}>
              {t.scheduleClear}
            </button>
          </div>
        )}
        {codeBlocks.length > 0 && (
          <div class="compose-code-hint pill">
            <Icon name="code-line" size={14} />
            <span>{t.codeAsImage}</span>
          </div>
        )}
        {gifOpen && <GifPicker apiKey={GIPHY_API_KEY} onSelect={(gif) => void pickGif(gif)} />}
        {emojiOpen && (
          <EmojiPanel instance={instance} account={account} onInsert={insertAtCursor} />
        )}
        <MediaAttachments
          media={media}
          onDescription={(index, value) =>
            setMedia((prev) => prev.map((m, i) => (i === index ? { ...m, description: value } : m)))
          }
          onRemove={(index) => setMedia((prev) => prev.filter((_, i) => i !== index))}
        />
        {uploading > 0 && (
          <div class="compose-uploading">
            <span class="spinner" /> {t.loading}
          </div>
        )}
        {poll && <PollEditor value={poll} onChange={setPoll} />}
        <VisibilityPicker
          value={visibility}
          localSupported={localSupported}
          onChange={setVisibility}
        />
      </div>
    </Sheet>
  );
}
