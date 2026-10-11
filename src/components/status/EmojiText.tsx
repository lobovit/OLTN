import type { JSX } from "preact";
import type { CustomEmoji } from "../../api/types";
import { normalizeEmojiUrl } from "../../lib/sanitize";

interface EmojiTextProps {
  text: string;
  emojis?: readonly CustomEmoji[] | null;
}

/** Texto com emojis customizados (:shortcode:) renderizados como imagens. */
export function EmojiText({ text, emojis }: EmojiTextProps): JSX.Element {
  if (!emojis?.length || !text.includes(":")) return <>{text}</>;
  const map = new Map<string, string>();
  for (const emoji of emojis) {
    const url = normalizeEmojiUrl(emoji.url);
    if (url) map.set(emoji.shortcode, url);
  }
  if (!map.size) return <>{text}</>;

  const re = /:([a-zA-Z0-9_]+):/g;
  const parts: (string | JSX.Element)[] = [];
  let last = 0;
  let key = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    const url = map.get(match[1]);
    if (!url) continue;
    if (match.index > last) parts.push(text.slice(last, match.index));
    parts.push(
      <img
        key={`e${key++}`}
        class="emoji"
        src={url}
        alt={match[0]}
        title={match[0]}
        width={20}
        height={20}
      />,
    );
    last = match.index + match[0].length;
  }
  if (!parts.length) return <>{text}</>;
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}
