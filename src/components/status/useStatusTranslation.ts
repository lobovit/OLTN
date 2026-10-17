import type { RefObject } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import type { AccountMeta, Status, Translation } from "../../api/types";
import { t } from "../../i18n/pt-BR";
import { httpStatusOf } from "../../lib/errors";
import { htmlToPlainText, plainTextToHtml } from "../../lib/format";
import { clientFor } from "../../lib/identity";
import { translateText } from "../../lib/translate";
import { toast } from "../../state/store";

/** Account+instance pairs that refused native translation (no service
    configured or target not permitted) — keyed per account so the capability
    cache never crosses accounts on the same instance. */
const nativeTranslateUnsupported = new Set<string>();

export interface StatusTranslationState {
  translated: Translation | null;
  transLang: string;
  translating: boolean;
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
  containerRef: RefObject<HTMLDivElement | null>;
  translate: (lang: string) => Promise<void>;
  showOriginal: () => void;
}

/** Tries the instance translation; records the capability when refused. */
async function tryInstanceTranslation(
  instance: string,
  capabilityKey: string,
  lang: string,
  resolveLocalId: () => Promise<string | null>,
): Promise<Translation | null> {
  const id = await resolveLocalId();
  if (!id) return null;
  try {
    const client = clientFor(instance).client;
    const instanceTranslation = await client.v1.statuses.$select(id).translate({ lang });
    // The instance may reply 200 without content (e.g. target language
    // unsupported by its backend); fall back to Google in that case.
    return instanceTranslation?.content ? instanceTranslation : null;
  } catch (err) {
    console.warn("[oltn] instance translate failed; using fallback", err);
    const status = httpStatusOf(err);
    if (status === 403 || status === 404) nativeTranslateUnsupported.add(capabilityKey);
    return null;
  }
}

/** Instance-first translation with a Google fallback (owns its menu state). */
export function useStatusTranslation(
  target: Status,
  account: AccountMeta | null,
  resolveLocalId: () => Promise<string | null>,
): StatusTranslationState {
  const [translated, setTranslated] = useState<Translation | null>(null);
  const [transLang, setTransLang] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [translating, setTranslating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent): void => {
      if (!containerRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [menuOpen]);

  const translateViaFallback = async (lang: string): Promise<Translation> => {
    const result = await translateText(htmlToPlainText(target.content), lang);
    return {
      content: plainTextToHtml(result.text),
      detectedLanguageSource: result.source ?? target.language ?? "",
      provider: "google",
    };
  };

  const translate = async (lang: string): Promise<void> => {
    if (!account || translating) return;
    setMenuOpen(false);
    setTranslating(true);
    const instance = account.instance;
    const capabilityKey = `${account.id}@${instance}`;
    try {
      let result: Translation | null = null;
      if (!nativeTranslateUnsupported.has(capabilityKey)) {
        result = await tryInstanceTranslation(instance, capabilityKey, lang, resolveLocalId);
      }
      if (!result) result = await translateViaFallback(lang);
      setTransLang(lang);
      setTranslated(result);
    } catch (err) {
      console.warn("[oltn] translate failed", err);
      toast(t.translateUnavailable, "error");
    } finally {
      setTranslating(false);
    }
  };

  const showOriginal = (): void => {
    setTranslated(null);
  };

  return {
    translated,
    transLang,
    translating,
    menuOpen,
    setMenuOpen,
    containerRef,
    translate,
    showOriginal,
  };
}
