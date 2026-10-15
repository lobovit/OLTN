/* Per-panel colors (deck columns and floating panels). The palette keys map to
   CSS variables in tokens.css. */

export const PANEL_COLORS = ["green", "orange", "purple", "blue", "pink"] as const;

export type PanelColor = (typeof PANEL_COLORS)[number];

/** Sets a panel color; an empty color removes the entry. */
export function updatePanelColor(
  colors: Readonly<Record<string, string>>,
  id: string,
  color: PanelColor | "",
): Record<string, string> {
  const next = { ...colors };
  if (color) next[id] = color;
  else delete next[id];
  return next;
}
