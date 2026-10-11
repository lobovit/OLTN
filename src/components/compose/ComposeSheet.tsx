import type { JSX } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { useSnapshot } from "valtio";
import { getCustomEmojis, getRest } from "../../api/client";
import type {
  ComposeIntent,
  ComposeVisibility,
  CustomEmoji,
  MediaAttachment,
} from "../../api/types";
import type { Account } from "../../api/types";
import { t } from "../../i18n/pt-BR";
import { extractCodeBlocks } from "../../lib/code-image";
import { fullDate, htmlToPlainText, languageName, toLocalInputValue } from "../../lib/format";
import { userMessageForError } from "../../lib/errors";
import { loadEmojiGroups, searchEmojis, type EmojiGroup, type EmojiItem } from "../../lib/emoji";
import { planPublish, type ComposeDraft } from "../../lib/publish-plan";
import { splitThreadText } from "../../lib/thread";
import { TRANSLATE_TARGETS, translateText } from "../../lib/translate";
import { readJSON, writeJSON } from "../../lib/storage";
import { Sheet } from "../ui/Sheet";
import { Icon } from "../ui/Icon";
import { Avatar } from "../ui/Avatar";
import { EmojiText } from "../status/EmojiText";
import { currentAccount, setCompose, store, toast } from "../../state/store";
import { executePublish } from "../../state/publish";

const CHAR_LIMIT = 500;
const DRAFT_KEY = "compose-draft";
const EMOJI_TONES = ["🏻", "🏼", "🏽", "🏾", "🏿"];

interface Draft {
  text: string;
  spoiler: string;
  visibility: ComposeVisibility;
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
  const [visOpen, setVisOpen] = useState(false);
  const [sensitive, setSensitive] = useState(false);
  const [media, setMedia] = useState<MediaAttachment[]>([]);
  const [uploading, setUploading] = useState(0);
  const [pollOn, setPollOn] = useState(false);
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [pollExpires, setPollExpires] = useState(86400);
  const [pollMultiple, setPollMultiple] = useState(false);
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
  const [emojiQuery, setEmojiQuery] = useState("");
  const [emojiTone, setEmojiTone] = useState(0);
  const [emojiData, setEmojiData] = useState<EmojiGroup[] | null>(null);
  const [customEmojis, setCustomEmojis] = useState<CustomEmoji[]>([]);
  const [transOpen, setTransOpen] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [translation, setTranslation] = useState<{ target: string; original: string } | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const mentionSeq = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const cwRef = useRef<HTMLInputElement>(null);
  const visPickerRef = useRef<HTMLDivElement>(null);

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

  /* closes the visibility menu when clicking outside */
  useEffect(() => {
    if (!visOpen) return;
    const onDown = (e: PointerEvent): void => {
      if (!visPickerRef.current?.contains(e.target as Node)) setVisOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [visOpen]);

  /* loads Unicode emojis (separate chunk) on first open */
  useEffect(() => {
    if (!emojiOpen || emojiData) return;
    let cancelled = false;
    void (async () => {
      try {
        const groups = await loadEmojiGroups(store.settings.language);
        if (!cancelled) setEmojiData(groups);
      } catch (err) {
        console.warn("[oltn] emoji data failed", err);
        if (!cancelled) setEmojiData([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [emojiOpen, emojiData]);

  /* loads the instance custom emojis on first open */
  useEffect(() => {
    if (!emojiOpen || !account) return;
    let cancelled = false;
    void (async () => {
      try {
        const list = await getCustomEmojis(instance, account.accessToken);
        if (!cancelled) setCustomEmojis(list.filter((e) => e.visibleInPicker));
      } catch (err) {
        console.warn("[oltn] custom emojis failed", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [emojiOpen, instance, account]);

  /* closes popovers (emoji/translation/schedule) when clicking outside or pressing Escape */
  useEffect(() => {
    if (!emojiOpen && !transOpen && !scheduleOpen) return;
    const onDown = (e: PointerEvent): void => {
      const el = e.target as HTMLElement;
      if (emojiOpen && !el.closest(".emoji-picker") && !el.closest("[data-emoji-toggle]")) {
        setEmojiOpen(false);
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
  }, [emojiOpen, transOpen, scheduleOpen]);

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

  const emojiPreview = (item: EmojiItem): string =>
    (emojiTone > 0 && item.s?.[emojiTone - 1]) || item.c;

  const pickEmoji = (item: EmojiItem): void => insertAtCursor(emojiPreview(item));

  const pickCustomEmoji = (custom: CustomEmoji): void => insertAtCursor(`:${custom.shortcode}: `);

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

  const visOptions: {
    value: ComposeVisibility;
    label: string;
    hint: string;
    icon: string;
  }[] = [
    { value: "public", label: t.visPublic, hint: t.visPublicHint, icon: "globe-line" },
    ...(localSupported
      ? [
          {
            value: "local" as ComposeVisibility,
            label: t.visLocal,
            hint: t.visLocalHint,
            icon: "building-2-line",
          },
        ]
      : []),
    { value: "unlisted", label: t.visUnlisted, hint: t.visUnlistedHint, icon: "eye-line" },
    { value: "private", label: t.visPrivate, hint: t.visPrivateHint, icon: "group-line" },
    { value: "direct", label: t.visDirect, hint: t.visDirectHint, icon: "mail-line" },
  ];
  const currentVis = visOptions.find((o) => o.value === visibility) ?? visOptions[0];

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
          const poll = status.poll;
          if (poll) {
            setPollOn(true);
            setPollOptions(poll.options.map((o) => o.title));
            setPollMultiple(poll.multiple);
            if (poll.expiresAt) {
              const remaining = Math.ceil((Date.parse(poll.expiresAt) - Date.now()) / 1000);
              setPollExpires(Math.max(300, remaining));
            }
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
    (!pollOn || pollOptions.every((o) => o.trim())) &&
    (!scheduleDate || (scheduleValid && !scheduleBlocked));

  const emojiNeedle = emojiQuery.trim().toLowerCase();
  const customMatches = emojiNeedle
    ? customEmojis.filter((e) => e.shortcode.toLowerCase().includes(emojiNeedle))
    : customEmojis.slice(0, 120);
  const unicodeMatches =
    emojiData && emojiQuery.trim() ? searchEmojis(emojiData, emojiQuery) : null;
  const codeBlocks = isEdit || pollOn ? [] : extractCodeBlocks(text);

  const upload = async (files: FileList | File[]): Promise<void> => {
    if (!account) return;
    const client = getRest(instance, account.accessToken);
    let count = media.length;
    for (const file of files) {
      if (count >= 4) break;
      count += 1;
      setUploading((n) => n + 1);
      try {
        const attachment = await client.v1.media.create({ file });
        setMedia((prev) => [...prev, attachment].slice(0, 4));
      } catch (err) {
        console.warn("[oltn] upload failed", err);
        toast(t.errorUpload, "error");
      } finally {
        setUploading((n) => n - 1);
      }
    }
  };

  const submit = async (): Promise<void> => {
    if (!account || !canSubmit) return;
    setBusy(true);
    try {
      const draft: ComposeDraft = {
        text,
        spoiler,
        showCw,
        visibility,
        sensitive,
        poll: pollOn
          ? {
              options: pollOptions.filter((o) => o.trim()),
              expiresIn: pollExpires,
              multiple: pollMultiple,
            }
          : undefined,
        media,
        replyToId: replyTo?.id,
        quoteId: quoteId ?? undefined,
        scheduledAt:
          scheduleDate && scheduleValid && !scheduleBlocked
            ? scheduleDate.toISOString()
            : undefined,
      };
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

  const title =
    intent.mode === "reply"
      ? t.composeReply
      : intent.mode === "quote"
        ? t.composeQuote
        : intent.mode === "edit"
          ? t.composeEdit
          : t.composeTitle;

  return (
    <Sheet
      title={title}
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
            disabled={media.length >= 4 || pollOn}
            onClick={() => fileRef.current?.click()}
          >
            <Icon name="attachment-line" size={20} />
          </button>
          <button
            type="button"
            class={`icon-btn ${pollOn ? "active" : ""}`}
            title={t.addPoll}
            aria-label={t.addPoll}
            disabled={!canPoll}
            onClick={() => {
              setPollOn((v) => !v);
              if (!pollOn) setMedia([]);
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
              setTransOpen(false);
            }}
          >
            <Icon name="emoji-line" size={20} />
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
            {isEdit
              ? busy
                ? t.saving
                : t.save
              : busy
                ? scheduleDate
                  ? t.scheduling
                  : t.posting
                : scheduleDate
                  ? t.schedule
                  : t.post}
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
        {mentionItems.length > 0 && (
          <div class="mention-menu" role="listbox" aria-label={t.mentionSuggest}>
            {mentionItems.map((candidate, index) => (
              <button
                key={candidate.id}
                type="button"
                role="option"
                aria-selected={index === mentionIndex}
                class={`mention-option ${index === mentionIndex ? "active" : ""}`}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setMentionIndex(index)}
                onClick={() => applyMention(candidate)}
              >
                <Avatar
                  src={candidate.avatar}
                  name={candidate.displayName || candidate.username}
                  size={28}
                />
                <span class="mention-name">
                  <EmojiText
                    text={candidate.displayName || candidate.username}
                    emojis={candidate.emojis}
                  />
                </span>
                <span class="mention-acct">@{candidate.acct}</span>
              </button>
            ))}
          </div>
        )}
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
        {transOpen && (
          <div class="translate-menu" role="listbox" aria-label={t.translateTo}>
            {TRANSLATE_TARGETS.map((code) => (
              <button
                key={code}
                type="button"
                role="option"
                class="translate-option"
                onClick={() => void translateDraft(code)}
              >
                <span>{languageName(code)}</span>
                <span class="faint">{code}</span>
              </button>
            ))}
          </div>
        )}
        {scheduleOpen && (
          <div class="schedule-panel">
            <label class="schedule-field">
              <span>{t.scheduleAt}</span>
              <input
                type="datetime-local"
                class="field"
                min={toLocalInputValue(new Date(Date.now() + 5 * 60_000))}
                value={scheduledAt}
                onInput={(e) => setScheduledAt((e.target as HTMLInputElement).value)}
              />
            </label>
            {scheduleDate && !scheduleValid && <p class="schedule-error">{t.scheduleTooSoon}</p>}
            <div class="schedule-actions">
              <button
                type="button"
                class="btn ghost sm"
                disabled={!scheduledAt}
                onClick={() => setScheduledAt("")}
              >
                {t.scheduleClear}
              </button>
              <button
                type="button"
                class="btn primary sm"
                disabled={!scheduleDate || !scheduleValid}
                onClick={() => setScheduleOpen(false)}
              >
                {t.confirm}
              </button>
            </div>
          </div>
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
        {emojiOpen && (
          <div class="emoji-picker" aria-label={t.emojiPicker}>
            <div class="emoji-picker-head">
              <input
                class="field emoji-search"
                type="search"
                placeholder={t.emojiSearch}
                value={emojiQuery}
                onInput={(e) => setEmojiQuery((e.target as HTMLInputElement).value)}
              />
              <div class="emoji-tones" role="radiogroup" aria-label={t.skinTone}>
                <button
                  type="button"
                  class={`emoji-tone ${emojiTone === 0 ? "active" : ""}`}
                  aria-pressed={emojiTone === 0}
                  title={t.skinTone}
                  onClick={() => setEmojiTone(0)}
                >
                  ✋
                </button>
                {EMOJI_TONES.map((tone, index) => (
                  <button
                    key={tone}
                    type="button"
                    class={`emoji-tone ${emojiTone === index + 1 ? "active" : ""}`}
                    aria-pressed={emojiTone === index + 1}
                    onClick={() => setEmojiTone(emojiTone === index + 1 ? 0 : index + 1)}
                  >
                    {`✋${tone}`}
                  </button>
                ))}
              </div>
            </div>
            <div class="emoji-scroll">
              {customMatches.length > 0 && (
                <section class="emoji-group">
                  <h4 class="emoji-group-title">{t.emojiCustom}</h4>
                  <div class="emoji-grid">
                    {customMatches.map((custom) => (
                      <button
                        key={custom.shortcode}
                        type="button"
                        class="emoji-btn emoji-custom"
                        title={`:${custom.shortcode}:`}
                        aria-label={`:${custom.shortcode}:`}
                        onClick={() => pickCustomEmoji(custom)}
                      >
                        <img
                          src={custom.staticUrl || custom.url}
                          alt=""
                          width={22}
                          height={22}
                          loading="lazy"
                        />
                      </button>
                    ))}
                  </div>
                </section>
              )}
              {unicodeMatches ? (
                <section class="emoji-group">
                  <div class="emoji-grid">
                    {unicodeMatches.map((item) => (
                      <button
                        key={item.c}
                        type="button"
                        class="emoji-btn"
                        title={item.l}
                        aria-label={item.l}
                        onClick={() => pickEmoji(item)}
                      >
                        {emojiPreview(item)}
                      </button>
                    ))}
                  </div>
                  {!unicodeMatches.length && !customMatches.length && (
                    <p class="muted emoji-empty">{t.emojiEmpty}</p>
                  )}
                </section>
              ) : emojiData?.length ? (
                emojiData.map((group) => (
                  <section class="emoji-group" key={group.id}>
                    <h4 class="emoji-group-title">{group.label}</h4>
                    <div class="emoji-grid">
                      {group.emojis.map((item) => (
                        <button
                          key={item.c}
                          type="button"
                          class="emoji-btn"
                          title={item.l}
                          aria-label={item.l}
                          onClick={() => pickEmoji(item)}
                        >
                          {emojiPreview(item)}
                        </button>
                      ))}
                    </div>
                  </section>
                ))
              ) : emojiData ? (
                <p class="muted emoji-empty">{t.emojiEmpty}</p>
              ) : (
                <div class="emoji-loading">
                  <span class="spinner" />
                </div>
              )}
            </div>
          </div>
        )}
        {media.length > 0 && (
          <div class="compose-media">
            {media.map((item, index) => (
              <div class="compose-media-item" key={item.id}>
                <img src={item.previewUrl || item.url || undefined} alt="" />
                <input
                  class="field"
                  placeholder={t.attachAlt}
                  value={item.description ?? ""}
                  onInput={(e) => {
                    const value = (e.target as HTMLInputElement).value;
                    setMedia((prev) =>
                      prev.map((m, i) => (i === index ? { ...m, description: value } : m)),
                    );
                  }}
                />
                <button
                  type="button"
                  class="icon-btn"
                  aria-label={t.delete}
                  onClick={() => setMedia((prev) => prev.filter((_, i) => i !== index))}
                >
                  <Icon name="close-line" size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
        {uploading > 0 && (
          <div class="compose-uploading">
            <span class="spinner" /> {t.loading}
          </div>
        )}
        {pollOn && (
          <div class="compose-poll">
            {pollOptions.map((option, index) => (
              <div class="poll-option-row" key={index}>
                <span class="muted">
                  {t.pollOption} {index + 1}
                </span>
                <input
                  class="field"
                  value={option}
                  onInput={(e) => {
                    const value = (e.target as HTMLInputElement).value;
                    setPollOptions((prev) => prev.map((o, i) => (i === index ? value : o)));
                  }}
                />
                {pollOptions.length > 2 && (
                  <button
                    type="button"
                    class="icon-btn"
                    aria-label={t.pollRemove}
                    onClick={() => setPollOptions((prev) => prev.filter((_, i) => i !== index))}
                  >
                    <Icon name="close-line" size={16} />
                  </button>
                )}
              </div>
            ))}
            {pollOptions.length < 4 && (
              <button
                type="button"
                class="btn ghost sm"
                onClick={() => setPollOptions((prev) => [...prev, ""])}
              >
                <Icon name="plus-line" size={14} />
                {t.pollAddOption}
              </button>
            )}
            <div class="poll-meta">
              <label>
                {t.pollExpires}
                <select
                  class="field"
                  value={pollExpires}
                  onChange={(e) => setPollExpires(Number((e.target as HTMLSelectElement).value))}
                >
                  <option value={300}>5 min</option>
                  <option value={1800}>30 min</option>
                  <option value={3600}>1 h</option>
                  <option value={21600}>6 h</option>
                  <option value={86400}>1 d</option>
                  <option value={604800}>7 d</option>
                </select>
              </label>
              <label class="check">
                <input
                  type="checkbox"
                  checked={pollMultiple}
                  onChange={(e) => setPollMultiple((e.target as HTMLInputElement).checked)}
                />
                {t.pollMultiple}
              </label>
            </div>
          </div>
        )}
        <div class="vis-picker" ref={visPickerRef}>
          <button
            type="button"
            class="btn ghost sm vis-btn"
            aria-haspopup="listbox"
            aria-expanded={visOpen}
            onClick={() => setVisOpen((v) => !v)}
          >
            <Icon name={currentVis.icon} size={15} />
            {currentVis.label}
            <Icon name="dropdown-line" size={12} class="vis-caret" />
          </button>
          {visOpen && (
            <div class="vis-menu" role="listbox" aria-label={t.visibility}>
              {visOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={opt.value === visibility}
                  class={`vis-option ${opt.value === visibility ? "active" : ""}`}
                  onClick={() => {
                    setVisibility(opt.value);
                    setVisOpen(false);
                  }}
                >
                  <Icon name={opt.icon} size={16} />
                  <span class="vis-text">
                    <span class="vis-name">{opt.label}</span>
                    <span class="vis-hint">{opt.hint}</span>
                  </span>
                  {opt.value === visibility && (
                    <Icon name="check-line" size={14} class="vis-check" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </Sheet>
  );
}
