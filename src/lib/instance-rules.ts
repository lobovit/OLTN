/* Instance rules: shape + translation lookup for the report form. */

export interface InstanceRule {
  id: string;
  text: string;
  /** Locale code to translated text. */
  translations: Record<string, string>;
}

/** Rule text for the given UI language, falling back to the original. */
export function ruleText(rule: InstanceRule, language: string): string {
  const exact = rule.translations[language];
  if (exact) return exact;
  const base = language.split("-")[0].toLowerCase();
  for (const [locale, text] of Object.entries(rule.translations)) {
    const code = locale.toLowerCase();
    if (code === base || code.startsWith(`${base}-`)) return text;
  }
  return rule.text;
}
