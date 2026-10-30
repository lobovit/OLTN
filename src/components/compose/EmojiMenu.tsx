import type { JSX } from "preact";
import { t } from "../../i18n/pt-BR";
import { normalizeEmojiUrl } from "../../lib/sanitize";
import type { EmojiSuggestion } from "./useEmojiMenu";

interface Props {
  items: readonly EmojiSuggestion[];
  index: number;
  onIndex: (index: number) => void;
  onPick: (suggestion: EmojiSuggestion) => void;
}

/** Inline `:shortcode` emoji suggestions (custom instance emojis + Unicode). */
export function EmojiMenu({ items, index, onIndex, onPick }: Props): JSX.Element | null {
  if (!items.length) return null;
  return (
    <div class="mention-menu emoji-menu" role="listbox" aria-label={t.emojiSuggest}>
      {items.map((suggestion, i) => {
        const custom = suggestion.kind === "custom";
        const url = custom ? normalizeEmojiUrl(suggestion.emoji.url) : null;
        return (
          <button
            key={custom ? `c:${suggestion.emoji.shortcode}` : `u:${suggestion.emoji.c}:${i}`}
            type="button"
            role="option"
            aria-selected={i === index}
            class={`mention-option ${i === index ? "active" : ""}`}
            onMouseDown={(e) => e.preventDefault()}
            onMouseEnter={() => onIndex(i)}
            onClick={() => onPick(suggestion)}
          >
            {custom ? (
              <img
                class="emoji"
                src={url ?? ""}
                alt={`:${suggestion.emoji.shortcode}:`}
                width={20}
                height={20}
              />
            ) : (
              <span class="emoji-suggestion-char">{suggestion.emoji.c}</span>
            )}
            <span class="mention-name">
              {custom ? `:${suggestion.emoji.shortcode}:` : suggestion.emoji.l}
            </span>
          </button>
        );
      })}
    </div>
  );
}
