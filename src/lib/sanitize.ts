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
  const tag = node.nodeName?.toUpperCase();
  if (tag === "A") {
    node.setAttribute("target", "_blank");
    node.setAttribute("rel", "noopener noreferrer nofollow");
  }
  if (tag === "IMG") {
    // `loading="lazy"` only with explicit dimensions — avoids CLS.
    if (node.hasAttribute("width") && node.hasAttribute("height")) {
      node.setAttribute("loading", "lazy");
    }
    node.setAttribute("decoding", "async");
  }
});

/** Sanitizes server HTML before rendering. */
export function sanitizeContent(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  }) as unknown as string;
}

/** Normalizes a custom emoji URL (https or protocol-relative). */
export function normalizeEmojiUrl(url: string): string | null {
  const raw = url.startsWith("//") ? `https:${url}` : url;
  return /^https:\/\//.test(raw) ? raw : null;
}

const SHORTCODE_ALT = /^:([a-zA-Z0-9_]+):$/;

/**
 * Marks as `.emoji` the emoji images the server already sent in the HTML.
 * The class varies by software (emojione, emoji, custom-emoji...), so we
 * detect by alt (:shortcode:) or by a known URL.
 */
function classifyServerEmojiImgs(root: HTMLElement, urls: ReadonlySet<string>): void {
  for (const img of root.querySelectorAll("img")) {
    const alt = img.getAttribute("alt") ?? "";
    if (urls.has(img.src) || SHORTCODE_ALT.test(alt)) {
      img.classList.add("emoji");
      // Emojis are square and scaled by CSS; explicit dimensions
      // allow lazy without layout shift (CLS).
      if (!img.hasAttribute("width")) img.setAttribute("width", "20");
      if (!img.hasAttribute("height")) img.setAttribute("height", "20");
      img.setAttribute("loading", "lazy");
    }
  }
}

/** Adjusts custom emojis in content: marks server ones and replaces
    shortcodes in plain text with images. */
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
      img.width = 20;
      img.height = 20;
      fragment.append(img);
      lastIndex = match.index + match[0].length;
    }
    if (!fragment.childNodes.length) continue;
    if (lastIndex < text.length) fragment.append(text.slice(lastIndex));
    node.replaceWith(fragment);
  }
}
