/* Text translation via Google Translate's public endpoint (free, no key).
   Used in the composer to translate the draft before publishing. */

const ENDPOINT = "https://translate.googleapis.com/translate_a/single";

/** Languages offered in the translation selectors (ISO 639-1).
    Use base codes Mastodon's I18n.available_locales understands: it ships
    pt-BR/pt-PT but no bare "pt", so "pt" would be silently ignored. */
export const TRANSLATE_TARGETS = ["pt-BR", "en", "es", "fr", "de", "it", "ja"];

export interface TranslateResult {
  text: string;
  /** Automatically detected language. */
  source?: string;
}

export async function translateText(
  text: string,
  target: string,
  signal?: AbortSignal,
): Promise<TranslateResult> {
  const body = new URLSearchParams({
    client: "gtx",
    sl: "auto",
    tl: target,
    dt: "t",
    q: text,
  });
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    signal,
  });
  if (!res.ok) throw new Error(`translate_http_${res.status}`);
  const data: unknown = await res.json();
  if (!Array.isArray(data) || !Array.isArray(data[0])) throw new Error("translate_parse");
  const translated = (data[0] as unknown[])
    .map((segment) => (Array.isArray(segment) ? String(segment[0] ?? "") : ""))
    .join("")
    .trim();
  if (!translated) throw new Error("translate_empty");
  const source = typeof data[2] === "string" ? data[2] : undefined;
  return { text: translated, source };
}
