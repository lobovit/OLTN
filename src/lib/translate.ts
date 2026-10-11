/* Tradução de texto via endpoint público do Google Translate (gratuito, sem chave).
   Usado no compose para traduzir o rascunho antes de publicar. */

const ENDPOINT = "https://translate.googleapis.com/translate_a/single";

/** Idiomas oferecidos nos seletores de tradução (ISO 639-1). */
export const TRANSLATE_TARGETS = ["pt", "en", "es", "fr", "de", "it", "ja"];

export interface TranslateResult {
  text: string;
  /** Idioma detectado automaticamente. */
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
