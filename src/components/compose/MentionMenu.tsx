import type { JSX } from "preact";
import type { Account } from "../../api/types";
import { t } from "../../i18n/pt-BR";
import { Avatar } from "../ui/Avatar";
import { EmojiText } from "../status/EmojiText";

interface MentionMenuProps {
  items: readonly Account[];
  index: number;
  onIndex: (index: number) => void;
  onPick: (account: Account) => void;
}

/** Account suggestions for the `@partial` mention autocomplete. */
export function MentionMenu({
  items,
  index,
  onIndex,
  onPick,
}: MentionMenuProps): JSX.Element | null {
  if (!items.length) return null;
  return (
    <div class="mention-menu" role="listbox" aria-label={t.mentionSuggest}>
      {items.map((candidate, i) => (
        <button
          key={candidate.id}
          type="button"
          role="option"
          aria-selected={i === index}
          class={`mention-option ${i === index ? "active" : ""}`}
          onMouseDown={(e) => e.preventDefault()}
          onMouseEnter={() => onIndex(i)}
          onClick={() => onPick(candidate)}
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
  );
}
