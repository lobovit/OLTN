/* Divide um texto longo em partes para virar thread, respeitando o limite. */

/** Ponto de corte preferencial: evita cortar no meio de palavras/frases. */
function findCut(rest: string, limit: number): number {
  const window = rest.slice(0, limit + 1);
  const min = Math.floor(limit * 0.4);
  const paragraph = window.lastIndexOf("\n\n");
  if (paragraph >= min) return paragraph + 2;
  const newline = window.lastIndexOf("\n");
  if (newline >= min) return newline + 1;
  const sentence = Math.max(
    window.lastIndexOf(". "),
    window.lastIndexOf("! "),
    window.lastIndexOf("? "),
  );
  if (sentence >= min) return sentence + 1;
  const space = window.lastIndexOf(" ");
  if (space >= min) return space;
  return limit;
}

/** Divide `text` em partes de até `limit` caracteres para publicar como thread. */
export function splitThreadText(text: string, limit: number): string[] {
  const trimmed = text.trim();
  if (limit <= 0 || trimmed.length <= limit) return [trimmed];

  const parts: string[] = [];
  let rest = trimmed;
  while (rest.length > limit) {
    const cut = findCut(rest, limit);
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) parts.push(rest);
  return parts.filter(Boolean);
}
