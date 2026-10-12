import type { JSX } from "preact";
import { t } from "../../i18n/pt-BR";
import { languageName } from "../../lib/format";
import { TRANSLATE_TARGETS } from "../../lib/translate";

interface TranslateMenuProps {
  onPick: (target: string) => void;
}

/** Target language list for draft translation. */
export function TranslateMenu({ onPick }: TranslateMenuProps): JSX.Element {
  return (
    <div class="translate-menu" role="listbox" aria-label={t.translateTo}>
      {TRANSLATE_TARGETS.map((code) => (
        <button
          key={code}
          type="button"
          role="option"
          class="translate-option"
          onClick={() => onPick(code)}
        >
          <span>{languageName(code)}</span>
          <span class="faint">{code}</span>
        </button>
      ))}
    </div>
  );
}
