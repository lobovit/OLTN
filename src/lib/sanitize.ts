import DOMPurify from "dompurify";

const ALLOWED_TAGS = [
  "p",
  "br",
  "a",
  "span",
  "em",
  "strong",
  "b",
  "i",
  "u",
  "del",
  "s",
  "code",
  "pre",
  "blockquote",
  "ul",
  "ol",
  "li",
  "img",
  "hr",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "sup",
  "sub",
  "details",
  "summary",
  "figure",
  "figcaption",
  "video",
  "audio",
  "source",
];

const ALLOWED_ATTR = [
  "href",
  "title",
  "class",
  "rel",
  "target",
  "src",
  "alt",
  "width",
  "height",
  "loading",
  "decoding",
  "poster",
  "controls",
  "loop",
  "muted",
  "preload",
  "type",
  "colspan",
  "rowspan",
  "dir",
  "lang",
];

DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node instanceof HTMLAnchorElement) {
    node.setAttribute("target", "_blank");
    node.setAttribute("rel", "noopener noreferrer nofollow");
  }
  if (node instanceof HTMLImageElement) {
    node.setAttribute("loading", "lazy");
    node.setAttribute("decoding", "async");
  }
});

/** Sanitiza o HTML vindo do servidor antes de renderizar. */
export function sanitizeContent(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  }) as unknown as string;
}

/** Normaliza URL de emoji customizado (https ou protocolo-relativo). */
export function normalizeEmojiUrl(url: string): string | null {
  const raw = url.startsWith("//") ? `https:${url}` : url;
  return /^https:\/\//.test(raw) ? raw : null;
}

const SHORTCODE_ALT = /^:([a-zA-Z0-9_]+):$/;

/**
 * Marca como `.emoji` as imagens de emoji que o servidor já mandou no HTML.
 * A classe varia por software (emojione, emoji, custom-emoji...), então
 * detectamos pelo alt (:shortcode:) ou pela URL conhecida.
 */
function classifyServerEmojiImgs(root: HTMLElement, urls: ReadonlySet<string>): void {
  for (const img of root.querySelectorAll("img")) {
    const alt = img.getAttribute("alt") ?? "";
    if (urls.has(img.src) || SHORTCODE_ALT.test(alt)) {
      img.classList.add("emoji");
    }
  }
}

/** Ajusta emojis customizados no conteúdo: marca os do servidor e troca
    shortcodes em texto puro por imagens. */
export function emojifyInPlace(
  root: HTMLElement,
  emojis: readonly { shortcode: string; url: string; staticUrl?: string }[],
): void {
  const map = new Map<string, string>();
  for (const emoji of emojis) {
    const url = normalizeEmojiUrl(emoji.url);
    if (url) map.set(emoji.shortcode, url);
  }

  classifyServerEmojiImgs(root, new Set(map.values()));

  if (!map.size) return;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (node.nodeValue?.includes(":")) textNodes.push(node);
  }

  const re = /:([a-zA-Z0-9_]+):/g;
  for (const node of textNodes) {
    const text = node.nodeValue ?? "";
    re.lastIndex = 0;
    if (!re.test(text)) continue;
    re.lastIndex = 0;
    const fragment = document.createDocumentFragment();
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(text))) {
      const url = map.get(match[1]);
      if (!url) continue;
      if (match.index > lastIndex) {
        fragment.append(text.slice(lastIndex, match.index));
      }
      const img = document.createElement("img");
      img.className = "emoji";
      img.src = url;
      img.alt = `:${match[1]}:`;
      img.title = `:${match[1]}:`;
      fragment.append(img);
      lastIndex = match.index + match[0].length;
    }
    if (!fragment.childNodes.length) continue;
    if (lastIndex < text.length) fragment.append(text.slice(lastIndex));
    node.replaceWith(fragment);
  }
}
