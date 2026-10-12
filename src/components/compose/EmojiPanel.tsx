import type { JSX } from "preact";
import { useEffect, useState } from "preact/hooks";
import { getCustomEmojis } from "../../api/client";
import type { AccountMeta, CustomEmoji } from "../../api/types";
import { t } from "../../i18n/pt-BR";
import { loadEmojiGroups, searchEmojis, type EmojiGroup, type EmojiItem } from "../../lib/emoji";
import { store } from "../../state/store";

const EMOJI_TONES = ["🏻", "🏼", "🏽", "🏾", "🏿"];

interface EmojiPanelProps {
  instance: string;
  account: AccountMeta | null;
  /** Inserts a snippet at the composer cursor. */
  onInsert: (snippet: string) => void;
}

/** Unicode + instance emoji picker (owns query, skin tone and datasets). */
export function EmojiPanel({ instance, account, onInsert }: EmojiPanelProps): JSX.Element {
  const [query, setQuery] = useState("");
  const [tone, setTone] = useState(0);
  const [data, setData] = useState<EmojiGroup[] | null>(null);
  const [custom, setCustom] = useState<CustomEmoji[]>([]);

  /* loads Unicode emojis (separate chunk) */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const groups = await loadEmojiGroups(store.settings.language);
        if (!cancelled) setData(groups);
      } catch (err) {
        console.warn("[oltn] emoji data failed", err);
        if (!cancelled) setData([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* loads the instance custom emojis */
  useEffect(() => {
    if (!account) return;
    let cancelled = false;
    void (async () => {
      try {
        const list = await getCustomEmojis(instance, account.accessToken);
        if (!cancelled) setCustom(list.filter((e) => e.visibleInPicker));
      } catch (err) {
        console.warn("[oltn] custom emojis failed", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [instance, account]);

  const needle = query.trim().toLowerCase();
  const customMatches = needle
    ? custom.filter((e) => e.shortcode.toLowerCase().includes(needle))
    : custom.slice(0, 120);
  const unicodeMatches = data && query.trim() ? searchEmojis(data, query) : null;

  const preview = (item: EmojiItem): string => (tone > 0 && item.s?.[tone - 1]) || item.c;
  const pick = (item: EmojiItem): void => onInsert(preview(item));
  const pickCustom = (item: CustomEmoji): void => onInsert(`:${item.shortcode}: `);

  return (
    <div class="emoji-picker" aria-label={t.emojiPicker}>
      <div class="emoji-picker-head">
        <input
          class="field emoji-search"
          type="search"
          placeholder={t.emojiSearch}
          value={query}
          onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
        />
        <div class="emoji-tones" role="radiogroup" aria-label={t.skinTone}>
          <button
            type="button"
            class={`emoji-tone ${tone === 0 ? "active" : ""}`}
            aria-pressed={tone === 0}
            title={t.skinTone}
            onClick={() => setTone(0)}
          >
            ✋
          </button>
          {EMOJI_TONES.map((skinTone, index) => (
            <button
              key={skinTone}
              type="button"
              class={`emoji-tone ${tone === index + 1 ? "active" : ""}`}
              aria-pressed={tone === index + 1}
              onClick={() => setTone(tone === index + 1 ? 0 : index + 1)}
            >
              {`✋${skinTone}`}
            </button>
          ))}
        </div>
      </div>
      <div class="emoji-scroll">
        {customMatches.length > 0 && (
          <section class="emoji-group">
            <h4 class="emoji-group-title">{t.emojiCustom}</h4>
            <div class="emoji-grid">
              {customMatches.map((item) => (
                <button
                  key={item.shortcode}
                  type="button"
                  class="emoji-btn emoji-custom"
                  title={`:${item.shortcode}:`}
                  aria-label={`:${item.shortcode}:`}
                  onClick={() => pickCustom(item)}
                >
                  <img
                    src={item.staticUrl || item.url}
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
                  onClick={() => pick(item)}
                >
                  {preview(item)}
                </button>
              ))}
            </div>
            {!unicodeMatches.length && !customMatches.length && (
              <p class="muted emoji-empty">{t.emojiEmpty}</p>
            )}
          </section>
        ) : data?.length ? (
          data.map((group) => (
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
                    onClick={() => pick(item)}
                  >
                    {preview(item)}
                  </button>
                ))}
              </div>
            </section>
          ))
        ) : data ? (
          <p class="muted emoji-empty">{t.emojiEmpty}</p>
        ) : (
          <div class="emoji-loading">
            <span class="spinner" />
          </div>
        )}
      </div>
    </div>
  );
}
