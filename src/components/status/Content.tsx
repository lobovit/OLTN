import type { JSX } from "preact";
import { useEffect, useRef } from "preact/hooks";
import type { CustomEmoji } from "../../api/types";
import { handleContentClick } from "../../lib/links";
import { emojifyInPlace, sanitizeContent } from "../../lib/sanitize";

interface ContentProps {
  html: string;
  emojis?: readonly CustomEmoji[] | null;
  class?: string;
  onClick?: (e: MouseEvent) => void;
}

export function Content({ html, emojis, class: className, onClick }: ContentProps): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const emojiKey = emojis ? emojis.map((e) => e.shortcode).join(",") : "";

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = sanitizeContent(html);
    emojifyInPlace(el, emojis ?? []);
  }, [html, emojiKey]);

  const handleClick = (e: MouseEvent) => {
    handleContentClick(e);
    onClick?.(e);
  };

  return <div ref={ref} class={`content ${className ?? ""}`} onClick={handleClick} />;
}
