import type { JSX } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { Icon } from "../components/ui/Icon";
import { t, type TKey } from "../i18n/pt-BR";
import { PANEL_COLORS, type PanelColor } from "../lib/panel-colors";
import { savePanelColor } from "../state/boot";

const LABELS: Record<PanelColor, TKey> = {
  green: "accentGreen",
  orange: "accentOrange",
  purple: "accentPurple",
  blue: "accentBlue",
  pink: "accentPink",
};

/** Palette button in the header of a deck column / floating panel. */
export function PanelColorButton({
  id,
  color,
  label,
}: {
  id: string;
  color?: string;
  label: string;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent): void => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [open]);

  const title = `${t.panelColor}: ${label}`;
  return (
    <div class="panel-color" ref={ref}>
      <button
        type="button"
        class="icon-btn panel-color-btn"
        title={title}
        aria-label={title}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name="palette-line" size={15} />
      </button>
      {open && (
        <div class="panel-color-menu" role="listbox" aria-label={title}>
          {PANEL_COLORS.map((key) => (
            <button
              key={key}
              type="button"
              role="option"
              aria-selected={color === key}
              data-color={key}
              class={`panel-swatch ${color === key ? "active" : ""}`}
              title={t[LABELS[key]]}
              aria-label={t[LABELS[key]]}
              onClick={() => {
                savePanelColor(id, key);
                setOpen(false);
              }}
            />
          ))}
          <button
            type="button"
            role="option"
            aria-selected={!color}
            class={`panel-swatch clear ${color ? "" : "active"}`}
            title={t.panelColorOff}
            aria-label={t.panelColorOff}
            onClick={() => {
              savePanelColor(id, "");
              setOpen(false);
            }}
          >
            <Icon name="close-line" size={11} />
          </button>
        </div>
      )}
    </div>
  );
}
